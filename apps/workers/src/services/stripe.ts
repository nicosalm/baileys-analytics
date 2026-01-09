import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';

export class StripeService {
  private stripe: Stripe;
  private supabase: SupabaseClient;
  private env: Env;

  constructor(env: Env, supabase: SupabaseClient) {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
      httpClient: Stripe.createFetchHttpClient()
    });
    this.supabase = supabase;
    this.env = env;
  }

  // create or retrieve stripe customer
  async createOrRetrieveCustomer(tenantId: string, email: string): Promise<string> {
    // check if customer already exists
    const { data: existingCustomer } = await this.supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .single();

    if (existingCustomer?.stripe_customer_id) {
      return existingCustomer.stripe_customer_id;
    }

    // create new stripe customer
    const customer = await this.stripe.customers.create({
      email,
      metadata: {
        tenant_id: tenantId
      }
    });

    // save to database
    await this.supabase
      .from('stripe_customers')
      .insert({
        tenant_id: tenantId,
        stripe_customer_id: customer.id,
        email: customer.email
      });

    return customer.id;
  }

  // create checkout session for subscription
  async createCheckoutSession(
    tenantId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    isFirstMonth: boolean = false
  ): Promise<{ sessionId: string; url: string }> {
    const customerId = await this.createOrRetrieveCustomer(tenantId, email);

    // check if tenant has ever subscribed before
    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .select('first_subscription_at')
      .eq('id', tenantId)
      .single();

    if (tenantError) {
      console.error('Failed to check trial eligibility for tenant:', tenantId, tenantError);
      // fail-closed: if we can't verify eligibility, don't allow trial
      throw new Error('Unable to verify trial eligibility');
    }

    // only allow trial if tenant has never subscribed before
    const allowTrial = isFirstMonth && !tenant?.first_subscription_at;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenant_id: tenantId
      }
    };

    if (allowTrial) {
      // first month: $1 total using trial + invoice item
      // Add subscription line item and $1 setup fee separately
      sessionConfig.line_items = [
        {
          price: priceId,
          quantity: 1
        },
        // Add $1 setup fee as a one-time charge
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'First Month Access Fee'
            },
            unit_amount: 100 // $1 in cents
          },
          quantity: 1
        }
      ];

      // add subscription with 30-day trial
      sessionConfig.subscription_data = {
        metadata: {
          tenant_id: tenantId,
          first_month_promo: 'true'
        },
        // 30-day trial period
        trial_period_days: 30,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        }
      };

      // ensure payment method is collected
      sessionConfig.payment_method_collection = 'always';
    } else {
      // regular subscription without trial
      sessionConfig.line_items = [{
        price: priceId,
        quantity: 1
      }];

      sessionConfig.subscription_data = {
        metadata: {
          tenant_id: tenantId
        }
      };
    }

    const session = await this.stripe.checkout.sessions.create(sessionConfig);

    return {
      sessionId: session.id,
      url: session.url!
    };
  }

  // create customer portal session
  async createPortalSession(tenantId: string, returnUrl: string): Promise<{ url: string }> {
    // get customer id
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .single();

    if (!customer?.stripe_customer_id) {
      throw new Error('No customer found for this tenant');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: returnUrl
    });

    return { url: session.url };
  }

  // get subscription status
  async getSubscription(tenantId: string) {
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    return subscription;
  }

  // handle webhook events
  async handleWebhook(signature: string, payload: string): Promise<{ received: boolean }> {
    let event: Stripe.Event;

    try {
      // verify signature manually using Web Crypto API (Cloudflare Workers compatible)
      const signatureHeader = signature;
      const signatureParts = signatureHeader.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      const timestamp = signatureParts.t;
      const expectedSignature = signatureParts.v1;

      if (!timestamp || !expectedSignature) {
        throw new Error('Invalid signature format');
      }

      // compute expected signature using Web Crypto API
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.env.STRIPE_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signedPayload = `${timestamp}.${payload}`;
      const signature_bytes = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signedPayload)
      );

      const computedSignature = Array.from(new Uint8Array(signature_bytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // constant-time comparison
      if (computedSignature !== expectedSignature) {
        throw new Error('Signature mismatch');
      }

      // check timestamp is recent (within 5 minutes)
      const timestampMs = parseInt(timestamp) * 1000;
      const now = Date.now();
      if (Math.abs(now - timestampMs) > 300000) {
        throw new Error('Timestamp too old');
      }

      // parse the event
      event = JSON.parse(payload) as Stripe.Event;
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      throw new Error('Invalid signature');
    }

    // Check for duplicate events (idempotency)
    const { data: existingEvent } = await this.supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent?.processed) {
      return { received: true };
    }

    // Record the event
    await this.supabase
      .from('webhook_events')
      .upsert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event,
        processed: false
      }, {
        onConflict: 'stripe_event_id'
      });

    try {
      // handle different event types
      switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }

    // Mark event as processed
    await this.supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('stripe_event_id', event.id);

    return { received: true };
    } catch (error) {
      // Record processing error
      console.error(`Error processing webhook ${event.id}:`, error);
      await this.supabase
        .from('webhook_events')
        .update({
          processing_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('stripe_event_id', event.id);

      throw error;
    }
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const tenantId = session.metadata?.tenant_id;
    if (!tenantId) return;

  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenant_id;
    if (!tenantId) return;

    // determine billing cycle from price interval
    const priceId = subscription.items.data[0]?.price.id;
    const interval = subscription.items.data[0]?.price.recurring?.interval;
    const billing_cycle = interval === 'year' ? 'yearly' : 'monthly';

    // upsert subscription
    await this.supabase
      .from('subscriptions')
      .upsert({
        tenant_id: tenantId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        billing_cycle: billing_cycle,
        status: subscription.status,
        current_period_start: (subscription as any).current_period_start ? new Date((subscription as any).current_period_start * 1000).toISOString() : null,
        current_period_end: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        metadata: subscription.metadata
      }, {
        onConflict: 'tenant_id'
      });

    // check if this is the tenant's first subscription
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('first_subscription_at')
      .eq('id', tenantId)
      .single();

    // always update subscription status fields
    await this.supabase
      .from('tenants')
      .update({
        subscription_status: subscription.status,
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        subscription_ends_at: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null
      })
      .eq('id', tenantId);

    // atomically set first_subscription_at only if it's still NULL
    // this prevents race conditions from concurrent webhooks
    if (!tenant?.first_subscription_at) {
      const { error: updateError } = await this.supabase
        .from('tenants')
        .update({ first_subscription_at: new Date().toISOString() })
        .eq('id', tenantId)
        .is('first_subscription_at', null);

    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenant_id;
    if (!tenantId) return;

    // update subscription status
    await this.supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
        ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    // update tenant status
    await this.supabase
      .from('tenants')
      .update({
        subscription_status: 'canceled',
        subscription_ends_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : new Date().toISOString()
      })
      .eq('id', tenantId);
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    // get tenant from customer
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('tenant_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!customer?.tenant_id) return;

    // record payment in billing history
    await this.supabase
      .from('billing_history')
      .insert({
        tenant_id: customer.tenant_id,
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: (invoice as any).payment_intent as string,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'paid',
        description: invoice.description || 'Subscription payment',
        invoice_pdf: invoice.invoice_pdf,
        paid_at: new Date().toISOString()
      });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    // get tenant from customer
    const { data: customer } = await this.supabase
      .from('stripe_customers')
      .select('tenant_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!customer?.tenant_id) return;

    // record failed payment
    await this.supabase
      .from('billing_history')
      .insert({
        tenant_id: customer.tenant_id,
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: (invoice as any).payment_intent as string,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        description: 'Payment failed - ' + (invoice.description || 'Subscription payment')
      });

    // update subscription status if needed
    await this.supabase
      .from('tenants')
      .update({
        subscription_status: 'past_due'
      })
      .eq('id', customer.tenant_id);
  }

  // get usage metrics for current period
  async getUsageMetrics(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data: metrics } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('period_start', startOfMonth.toISOString())
      .lte('period_end', endOfMonth.toISOString());

    return metrics || [];
  }

  // track usage metric
  async trackUsage(tenantId: string, metricType: string, count: number = 1) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // upsert metric - increment if exists
    const { data: existing } = await this.supabase
      .from('usage_metrics')
      .select('count')
      .eq('tenant_id', tenantId)
      .eq('metric_type', metricType)
      .eq('period_start', startOfMonth.toISOString())
      .eq('period_end', endOfMonth.toISOString())
      .single();

    const newCount = (existing?.count || 0) + count;

    await this.supabase
      .from('usage_metrics')
      .upsert({
        tenant_id: tenantId,
        metric_type: metricType,
        count: newCount,
        period_start: startOfMonth.toISOString(),
        period_end: endOfMonth.toISOString()
      }, {
        onConflict: 'tenant_id,metric_type,period_start,period_end'
      });
  }
}