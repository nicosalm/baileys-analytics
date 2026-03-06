# stripe billing integration setup

single-tier pricing: $20/month or $192/year

## environment variables

### frontend (apps/web)

add to `.env`:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key-here
```

### backend (apps/workers)

add secrets using wrangler cli:

```bash
# stripe api keys
wrangler secret put STRIPE_SECRET_KEY
# enter: sk_test_your-secret-key-here

wrangler secret put STRIPE_WEBHOOK_SECRET
# enter: whsec_your-webhook-secret-here

# stripe price ids (2 total)
wrangler secret put STRIPE_PRICE_MONTHLY
# enter: price_xxx (for $20/month)

wrangler secret put STRIPE_PRICE_YEARLY
# enter: price_xxx (for $192/year)
```

for production deployment:
```bash
wrangler secret put STRIPE_SECRET_KEY --env production
# repeat for all secrets with --env production flag
```

## stripe product configuration

### 1. create product in stripe dashboard

create single product:

#### baileys analytics
- **name**: baileys analytics
- **description**: complete vacation rental analytics
- **monthly price**: $20.00
- **yearly price**: $192.00 (20% discount)
- **features**:
  - full analytics dashboard
  - real-time ownerrez sync
  - financial & occupancy insights
  - guest history & analytics
  - advanced tax tracking
  - season analysis
  - email support
  - unlimited properties

### 2. configure stripe webhook

1. go to stripe dashboard → developers → webhooks
2. add endpoint:
   - **endpoint url**: `https://your-api.workers.dev/api/billing/webhook`
   - **events to listen for**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
3. save the webhook signing secret as `STRIPE_WEBHOOK_SECRET`

### 3. configure customer portal

1. go to stripe dashboard → settings → billing → customer portal
2. enable the following features:
   - update payment methods
   - cancel subscriptions
   - view invoices
   - switch billing cycle (monthly ↔ yearly)
3. set cancellation policy:
   - immediate cancellation
   - access until period end
4. save configuration

## database setup

subscription data is tracked in supabase tables:
- `stripe_customers` - links tenants to stripe customers
- `subscriptions` - subscription status, billing cycle, periods
- `billing_history` - payment records
- `usage_metrics` - usage tracking
- `webhook_events` - webhook idempotency

## first month $1 pricing structure

new customer offer:

1. **new customer flow**:
   - user signs up and selects billing cycle (monthly/yearly)
   - pays $1 immediately (setup fee)
   - gets 30-day trial period
   - after 30 days, regular subscription pricing begins

2. **implementation details**:
   - $1 charged as one-time setup fee
   - subscription starts with 30-day trial
   - card required and saved for future charges
   - after trial, regular pricing applies ($20/mo or $192/yr)

3. **existing customer flow**:
   - can switch billing cycle through customer portal
   - no $1 offer (regular pricing applies)
   - proration handled automatically by stripe

## testing

### test cards

use these test cards in stripe's test mode:

- **success**: `4242 4242 4242 4242`
- **declined**: `4000 0000 0000 0002`
- **authentication required**: `4000 0025 0000 3155`

### test scenarios

1. **new user signup with $1 first month**:
   ```
   1. sign up for new account
   2. select billing cycle (monthly or yearly)
   3. enter test card
   4. verify $1 charge
   5. check subscription status in settings
   ```

2. **billing cycle switch**:
   ```
   1. go to settings → billing
   2. click "manage subscription"
   3. switch between monthly/yearly
   4. verify proration
   ```

3. **subscription cancellation**:
   ```
   1. go to settings → billing
   2. click "manage subscription"
   3. cancel subscription
   4. verify access continues until period end
   ```

4. **failed payment**:
   ```
   1. use declining test card
   2. verify error handling
   3. check subscription status
   ```

## monitoring

### key metrics to track

1. **subscription metrics**:
   - new subscriptions per day
   - churn rate
   - mrr (monthly recurring revenue)
   - monthly vs yearly distribution

2. **payment metrics**:
   - success rate
   - failed payments
   - recovery rate

3. **usage metrics** (tracked in `usage_metrics` table):
   - api calls per tenant
   - properties per tenant
   - reports generated

### webhook monitoring

monitor webhook events in stripe dashboard:
- check for failed webhooks
- review event logs
- set up alerts for failures

## troubleshooting

### common issues

1. **"no active subscription" error**:
   - check if tenant has subscription in database
   - verify subscription status is 'active' or 'trialing'
   - check if within grace period (1 day for new accounts)

2. **webhook signature verification failed**:
   - verify `STRIPE_WEBHOOK_SECRET` is correct
   - check endpoint url matches exactly
   - ensure raw request body is used for verification

3. **checkout session fails to create**:
   - verify stripe price ids are configured (2 total)
   - check stripe api key is valid
   - review error logs in cloudflare dashboard

4. **customer portal not loading**:
   - ensure customer has stripe customer record
   - verify portal is configured in stripe
   - check return url is correct

## security considerations

1. **never expose secret keys**:
   - use environment variables
   - never commit keys to git
   - rotate keys regularly

2. **webhook verification**:
   - always verify webhook signatures
   - use webhook secrets
   - validate event data

3. **access control**:
   - subscription middleware protects dashboard routes
   - billing routes require authentication
   - webhook endpoint is public but verified

## support

for issues or questions:
- check stripe logs in dashboard
- review cloudflare workers logs
- contact support with tenant id and timestamp
