import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';

export class StripeService {
  private stripe: Stripe;
  private supabase: SupabaseClient;
  private env: Env;

  constructor(env: Env, supabase: SupabaseClient) {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
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

    if (isFirstMonth) {
      // first month: $1 total using trial + invoice item
      sessionConfig.line_items = [{
        price: priceId,
        quantity: 1
      }];

      // add subscription with 30-day trial and $1 setup fee as invoice item
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
        },
        // Add $1 as an invoice item that will be charged immediately
        add_invoice_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'First Month Access Fee'
            },
            unit_amount: 100 // $1 in cents
          }
        }]
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
      .select(`
        *,
        subscription_plans (
          name,
          price_monthly,
          price_yearly,
          max_properties,
          features
        )
      `)
      .eq('tenant_id', tenantId)
      .single();

    return subscription;
  }

  // handle webhook events
  async handleWebhook(signature: string, payload: string): Promise<{ received: boolean }> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.env.STRIPE_WEBHOOK_SECRET
      );
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
      console.log(`Event ${event.id} already processed, skipping`);
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
        console.log(`Unhandled event type: ${event.type}`);
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

    // subscription will be created/updated through subscription webhook
    console.log('Checkout completed for tenant:', tenantId);
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenant_id;
    if (!tenantId) return;

    // get the plan details
    const priceId = subscription.items.data[0]?.price.id;
    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('id')
      .eq('stripe_price_id', priceId)
      .single();

    // upsert subscription
    await this.supabase
      .from('subscriptions')
      .upsert({
        tenant_id: tenantId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        plan_id: plan?.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        metadata: subscription.metadata
      }, {
        onConflict: 'tenant_id'
      });

    // update tenant subscription status
    await this.supabase
      .from('tenants')
      .update({
        subscription_status: subscription.status,
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        subscription_ends_at: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
      })
      .eq('id', tenantId);
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
        stripe_payment_intent_id: invoice.payment_intent as string,
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
        stripe_payment_intent_id: invoice.payment_intent as string,
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