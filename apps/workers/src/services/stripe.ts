import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFERRED_TIER_METADATA_KEY } from './tier-reconciliation';

export class StripeService {
	readonly stripe: Stripe;
	private supabase: SupabaseClient;
	private env: Env;

	constructor(env: Env, supabase: SupabaseClient) {
		this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
			apiVersion: '2025-10-29.clover',
			httpClient: Stripe.createFetchHttpClient(),
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
				tenant_id: tenantId,
			},
		});

		// save to database
		await this.supabase.from('stripe_customers').insert({
			tenant_id: tenantId,
			stripe_customer_id: customer.id,
			email: customer.email,
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
	): Promise<{ sessionId: string; url: string }> {
		const customerId = await this.createOrRetrieveCustomer(tenantId, email);

		const sessionConfig: Stripe.Checkout.SessionCreateParams = {
			customer: customerId,
			payment_method_types: ['card'],
			mode: 'subscription',
			success_url: successUrl,
			cancel_url: cancelUrl,
			metadata: {
				tenant_id: tenantId,
			},
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			subscription_data: {
				metadata: {
					tenant_id: tenantId,
				},
			},
		};

		const session = await this.stripe.checkout.sessions.create(sessionConfig);

		return {
			sessionId: session.id,
			url: session.url!,
		};
	}

	// create customer portal session
	async createPortalSession(tenantId: string, returnUrl: string): Promise<{ url: string }> {
		// get customer id
		const { data: customer } = await this.supabase.from('stripe_customers').select('stripe_customer_id').eq('tenant_id', tenantId).single();

		if (!customer?.stripe_customer_id) {
			throw new Error('No customer found for this tenant');
		}

		const session = await this.stripe.billingPortal.sessions.create({
			customer: customer.stripe_customer_id,
			return_url: returnUrl,
		});

		return { url: session.url };
	}

	// get subscription status. lazily backfills tier/unit_amount/stripe_price_id
	// by reading the live Stripe subscription if those columns are null. this lets
	// pre-existing rows (created before the tier columns existed) self-heal on
	// first read instead of needing a one-shot backfill script.
	async getSubscription(tenantId: string) {
		const { data: subscription } = await this.supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).single();

		if (!subscription) return null;

		if (subscription.tier == null && subscription.stripe_subscription_id) {
			try {
				const live = await this.stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
				const priceObj = live.items.data[0]?.price;
				const tier = (priceObj?.metadata?.tier as string | undefined) ?? 'legacy';
				const unit_amount = priceObj?.unit_amount ?? null;
				const stripe_price_id = priceObj?.id ?? null;

				await this.supabase.from('subscriptions').update({ tier, unit_amount, stripe_price_id }).eq('tenant_id', tenantId);

				return { ...subscription, tier, unit_amount, stripe_price_id };
			} catch (err) {
				console.error('Failed to backfill subscription tier from Stripe:', err);
			}
		}

		return subscription;
	}

	// handle webhook events
	async handleWebhook(signature: string, payload: string): Promise<{ received: boolean }> {
		let event: Stripe.Event;

		try {
			// verify signature manually using Web Crypto API (Cloudflare Workers compatible)
			const signatureHeader = signature;
			const signatureParts = signatureHeader.split(',').reduce(
				(acc, part) => {
					const [key, value] = part.split('=');
					acc[key] = value;
					return acc;
				},
				{} as Record<string, string>,
			);

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
				['sign'],
			);

			const signedPayload = `${timestamp}.${payload}`;
			const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));

			const computedSignature = Array.from(new Uint8Array(signature_bytes))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			// constant-time comparison
			const sigA = encoder.encode(computedSignature);
			const sigB = encoder.encode(expectedSignature);
			if (sigA.byteLength !== sigB.byteLength || !crypto.subtle.timingSafeEqual(sigA, sigB)) {
				throw new Error('Signature mismatch');
			}

			// check timestamp is recent (within 5 minutes)
			const timestampMs = parseInt(timestamp, 10) * 1000;
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

		// atomic idempotency: insert event, skip if already exists
		const { error: insertError } = await this.supabase
			.from('stripe_webhook_events')
			.insert({
				stripe_event_id: event.id,
				event_type: event.type,
				payload: event,
				processed: false,
			})
			.select('id')
			.single();

		if (insertError) {
			// unique constraint violation means event already exists
			const isDuplicate =
				insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique');
			if (!isDuplicate) {
				throw insertError;
			}
			// a Stripe retry of an event whose first attempt failed must be processed again
			const { data: existing } = await this.supabase
				.from('stripe_webhook_events')
				.select('processed')
				.eq('stripe_event_id', event.id)
				.maybeSingle();
			if (existing?.processed !== false) {
				return { received: true };
			}
		}

		try {
			// handle different event types
			let eventTenantId: string | null = null;

			switch (event.type) {
				case 'checkout.session.completed':
					eventTenantId = await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
					break;

				case 'customer.subscription.created':
				case 'customer.subscription.updated':
					eventTenantId = await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
					break;

				case 'customer.subscription.deleted':
					eventTenantId = await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
					break;

				case 'invoice.payment_succeeded':
					eventTenantId = await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
					break;

				case 'invoice.payment_failed':
					eventTenantId = await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
					break;

				default:
					break;
			}

			// mark event as processed (with tenant_id for data cleanup)
			await this.supabase
				.from('stripe_webhook_events')
				.update({
					processed: true,
					processed_at: new Date().toISOString(),
					...(eventTenantId ? { tenant_id: eventTenantId } : {}),
				})
				.eq('stripe_event_id', event.id);

			return { received: true };
		} catch (error) {
			// Record processing error
			console.error(`Error processing webhook ${event.id}:`, error);
			await this.supabase
				.from('stripe_webhook_events')
				.update({
					processing_error: error instanceof Error ? error.message : 'Unknown error',
				})
				.eq('stripe_event_id', event.id);

			throw error;
		}
	}

	private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<string | null> {
		const tenantId = session.metadata?.tenant_id;
		if (!tenantId) return null;

		// sync subscription records as a fallback in case customer.subscription.created is delayed
		if (session.subscription) {
			try {
				const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);
				await this.handleSubscriptionUpdate(subscription);
			} catch (err) {
				console.error('Failed to sync subscription from checkout session:', err);
			}
		}

		return tenantId;
	}

	private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<string | null> {
		const tenantId = subscription.metadata?.tenant_id;
		if (!tenantId) return null;

		// bail out if tenant was deleted (e.g. admin delete triggered the cancellation)
		const { data: tenantExists } = await this.supabase.from('tenants').select('id').eq('id', tenantId).single();
		if (!tenantExists) return tenantId;

		// resolve plan details from the active price. tier comes from price.metadata
		// which we set on every new tier price; legacy grandfathered prices have no
		// metadata so they store as 'legacy'.
		const priceObj = subscription.items.data[0]?.price;
		const interval = priceObj?.recurring?.interval;
		const billing_cycle = interval === 'year' ? 'yearly' : 'monthly';
		const livePriceTier = (priceObj?.metadata?.tier as string | undefined) ?? 'legacy';
		const unit_amount = priceObj?.unit_amount ?? null;
		const stripe_price_id = priceObj?.id ?? null;

		// Deferred tier change detection: when the cron pushes a pending tier into
		// Stripe, it tags the subscription with DEFERRED_TIER_METADATA_KEY = <new
		// tier slug>. The customer.subscription.updated webhook fires immediately
		// (price changed) but we DON'T want to flip the displayed tier yet — that
		// should happen only when the renewal invoice is actually paid. So when
		// the metadata is present and points at the same tier the new live price
		// resolves to, we leave tier/unit_amount on their existing DB values and
		// only sync the auxiliary fields. handleInvoicePaymentSucceeded promotes
		// the change once billing actually happens.
		const deferredTier = subscription.metadata?.[DEFERRED_TIER_METADATA_KEY] as string | undefined;
		const isDeferredInFlight = deferredTier != null && deferredTier === livePriceTier;

		let tierWrite: string | null;
		let unitAmountWrite: number | null;
		let stripePriceIdWrite: string | null;

		if (isDeferredInFlight) {
			// preserve the customer-facing tier/amount; only the cron's pending
			// record knows the new state, and that's what the UI reads. Defensive
			// fallback: if for any reason the existing row is missing (shouldn't be
			// possible — the cron only sets the deferred metadata on a sub that
			// already had a row in DB), fall back to live price values rather than
			// blanking out the tier columns.
			const { data: existing } = await this.supabase
				.from('subscriptions')
				.select('tier, unit_amount, stripe_price_id')
				.eq('tenant_id', tenantId)
				.single();
			if (existing?.tier != null) {
				tierWrite = existing.tier as string;
				unitAmountWrite = (existing.unit_amount as number | null) ?? unit_amount;
				stripePriceIdWrite = (existing.stripe_price_id as string | null) ?? stripe_price_id;
			} else {
				tierWrite = livePriceTier;
				unitAmountWrite = unit_amount;
				stripePriceIdWrite = stripe_price_id;
			}
		} else {
			tierWrite = livePriceTier;
			unitAmountWrite = unit_amount;
			stripePriceIdWrite = stripe_price_id;
		}

		// stripe SDK v19+ moved current_period fields from Subscription to SubscriptionItem
		const periodItem = subscription.items.data[0];

		// upsert subscription; throw on failure so the event stays unprocessed and Stripe retries
		const { error: subscriptionError } = await this.supabase.from('subscriptions').upsert(
			{
				tenant_id: tenantId,
				stripe_subscription_id: subscription.id,
				stripe_customer_id: subscription.customer as string,
				billing_cycle: billing_cycle,
				tier: tierWrite,
				unit_amount: unitAmountWrite,
				stripe_price_id: stripePriceIdWrite,
				status: subscription.status,
				current_period_start: periodItem?.current_period_start ? new Date(periodItem.current_period_start * 1000).toISOString() : null,
				current_period_end: periodItem?.current_period_end ? new Date(periodItem.current_period_end * 1000).toISOString() : null,
				trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
				trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
				cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
				canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
				metadata: subscription.metadata,
			},
			{
				onConflict: 'tenant_id',
			},
		);
		if (subscriptionError) {
			throw subscriptionError;
		}

		// check if this is the tenant's first subscription
		const { data: tenant } = await this.supabase.from('tenants').select('first_subscription_at').eq('id', tenantId).single();

		// always update subscription status fields
		await this.supabase
			.from('tenants')
			.update({
				subscription_status: subscription.status,
				trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
				subscription_ends_at: periodItem?.current_period_end ? new Date(periodItem.current_period_end * 1000).toISOString() : null,
			})
			.eq('id', tenantId);

		// atomically set first_subscription_at only if it's still NULL
		// this prevents race conditions from concurrent webhooks
		if (!tenant?.first_subscription_at) {
			await this.supabase
				.from('tenants')
				.update({ first_subscription_at: new Date().toISOString() })
				.eq('id', tenantId)
				.is('first_subscription_at', null);
		}

		return tenantId;
	}

	private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<string | null> {
		const tenantId = subscription.metadata?.tenant_id;
		if (!tenantId) return null;

		// bail out if tenant was deleted
		const { data: tenantExists } = await this.supabase.from('tenants').select('id').eq('id', tenantId).single();
		if (!tenantExists) return tenantId;

		// update subscription status. also clear any pending tier row — if the
		// customer cancelled while in overage, we don't want a stale pending row
		// to attach itself to a future re-subscription with a different
		// stripe_subscription_id.
		await this.supabase
			.from('subscriptions')
			.update({
				status: 'canceled',
				canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
				ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : new Date().toISOString(),
				pending_tier: null,
				pending_price_id: null,
				pending_unit_amount: null,
				pending_effective_at: null,
			})
			.eq('stripe_subscription_id', subscription.id);

		// update tenant status
		await this.supabase
			.from('tenants')
			.update({
				subscription_status: 'canceled',
				subscription_ends_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : new Date().toISOString(),
			})
			.eq('id', tenantId);

		return tenantId;
	}

	private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<string | null> {
		const customerId = invoice.customer as string;

		// get tenant from customer
		const { data: customer } = await this.supabase
			.from('stripe_customers')
			.select('tenant_id')
			.eq('stripe_customer_id', customerId)
			.single();

		if (!customer?.tenant_id) return null;

		// record payment in billing history (idempotent on webhook retry)
		await this.supabase.from('billing_history').upsert(
			{
				tenant_id: customer.tenant_id,
				stripe_invoice_id: invoice.id,
				stripe_payment_intent_id: (invoice as any).payment_intent as string,
				amount: invoice.amount_paid,
				currency: invoice.currency,
				status: 'paid',
				description: invoice.description || 'Subscription payment',
				invoice_pdf: invoice.invoice_pdf,
				paid_at: new Date().toISOString(),
			},
			{
				onConflict: 'stripe_invoice_id',
			},
		);

		// Promote a deferred tier change if there is one. The cron sets metadata
		// on the Stripe subscription and writes a pending row in DB; both got
		// suppressed from the customer view by handleSubscriptionUpdate. Now that
		// an actual invoice has been paid (= the new period started), it's safe to
		// promote. Read stripe_subscription_id from our DB rather than from the
		// invoice payload — the invoice.subscription field was deprecated/moved
		// in newer Stripe API versions and casting through `any` would silently
		// drop it. Our DB row is authoritative because handleSubscriptionUpdate
		// would have written it.
		try {
			const { data: dbSub } = await this.supabase
				.from('subscriptions')
				.select('stripe_subscription_id')
				.eq('tenant_id', customer.tenant_id)
				.single();
			if (dbSub?.stripe_subscription_id) {
				await this.promoteDeferredTierChangeIfAny(customer.tenant_id, dbSub.stripe_subscription_id);
			}
		} catch (err) {
			console.error(`promoteDeferredTierChangeIfAny failed for ${customer.tenant_id}:`, err);
		}

		return customer.tenant_id;
	}

	// Reads the live Stripe sub; if it's tagged with DEFERRED_TIER_METADATA_KEY,
	// copies pending_* → tier/unit_amount/stripe_price_id, clears the pending
	// row, and strips the metadata flag from Stripe. Idempotent: a no-op if the
	// metadata isn't set.
	private async promoteDeferredTierChangeIfAny(tenantId: string, subscriptionId: string): Promise<void> {
		const live = await this.stripe.subscriptions.retrieve(subscriptionId);
		const deferredTier = live.metadata?.[DEFERRED_TIER_METADATA_KEY];
		if (!deferredTier) return;

		const priceObj = live.items.data[0]?.price;
		const livePriceTier = (priceObj?.metadata?.tier as string | undefined) ?? 'legacy';
		if (livePriceTier !== deferredTier) {
			// Stripe is no longer on the deferred tier (maybe the customer moved
			// again via portal). just clear the flag.
			await this.stripe.subscriptions.update(subscriptionId, {
				metadata: { ...live.metadata, [DEFERRED_TIER_METADATA_KEY]: null },
			});
			await this.supabase
				.from('subscriptions')
				.update({
					pending_tier: null,
					pending_price_id: null,
					pending_unit_amount: null,
					pending_effective_at: null,
				})
				.eq('tenant_id', tenantId);
			return;
		}

		// Promote: write live price details into the tier columns. We trust the
		// live Stripe state over our DB pending_* row in case anything drifted.
		await this.supabase
			.from('subscriptions')
			.update({
				tier: deferredTier,
				unit_amount: priceObj?.unit_amount ?? null,
				stripe_price_id: priceObj?.id ?? null,
				pending_tier: null,
				pending_price_id: null,
				pending_unit_amount: null,
				pending_effective_at: null,
			})
			.eq('tenant_id', tenantId);

		// Strip the metadata so subsequent webhooks (e.g. unrelated portal edits)
		// don't keep getting suppressed.
		await this.stripe.subscriptions.update(subscriptionId, {
			metadata: { ...live.metadata, [DEFERRED_TIER_METADATA_KEY]: null },
		});
	}

	private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<string | null> {
		const customerId = invoice.customer as string;

		// get tenant from customer
		const { data: customer } = await this.supabase
			.from('stripe_customers')
			.select('tenant_id')
			.eq('stripe_customer_id', customerId)
			.single();

		if (!customer?.tenant_id) return null;

		// record failed payment (idempotent on webhook retry)
		await this.supabase.from('billing_history').upsert(
			{
				tenant_id: customer.tenant_id,
				stripe_invoice_id: invoice.id,
				stripe_payment_intent_id: (invoice as any).payment_intent as string,
				amount: invoice.amount_due,
				currency: invoice.currency,
				status: 'failed',
				description: `Payment failed - ${invoice.description || 'Subscription payment'}`,
			},
			{
				onConflict: 'stripe_invoice_id',
			},
		);

		// update subscription status if needed
		await this.supabase
			.from('tenants')
			.update({
				subscription_status: 'past_due',
			})
			.eq('id', customer.tenant_id);

		return customer.tenant_id;
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

	// track usage metric (atomic increment via RPC)
	async trackUsage(tenantId: string, metricType: string, count: number = 1) {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

		await this.supabase.rpc('increment_usage_metric', {
			p_tenant_id: tenantId,
			p_metric_type: metricType,
			p_period_start: startOfMonth.toISOString(),
			p_period_end: endOfMonth.toISOString(),
			p_count: count,
		});
	}
}
