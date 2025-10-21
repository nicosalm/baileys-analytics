# stripe production setup guide

## overview
production backend: `baileys-analytics-api-production`
pricing: single tier - $20/month or $192/year

## step 1: find your production api url

cloudflare worker url options:
1. **default workers.dev url**: `https://baileys-analytics-api-production.<subdomain>.workers.dev`
2. **custom domain**: if configured in cloudflare dashboard

### find the exact url:
```bash
# method 1: check cloudflare dashboard
# go to: https://dash.cloudflare.com -> workers & pages -> baileys-analytics-api-production

# method 2: test the health endpoint
curl https://baileys-analytics-api-production.<YOUR_SUBDOMAIN>.workers.dev/api/health

# method 3: check frontend production config
# api url should be in pages deployment environment variables
```

## step 2: switch to live mode in stripe

1. go to [stripe dashboard](https://dashboard.stripe.com)
2. toggle from **test mode** to **live mode** (top right)
3. ⚠️ **important**: create new products and prices in live mode

## step 3: create production webhook

1. go to [stripe webhooks](https://dashboard.stripe.com/webhooks) (live mode)
2. click **add endpoint**
3. **endpoint url**: `https://<YOUR_PRODUCTION_WORKER_URL>/api/billing/webhook`
   - example: `https://baileys-analytics-api-production.workers.dev/api/billing/webhook`
4. **description**: production webhook for baileys analytics
5. **events to send**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
6. click **add endpoint**
7. **copy the signing secret** (starts with `whsec_`)

## step 4: get live api keys

1. go to [stripe api keys](https://dashboard.stripe.com/apikeys) (live mode)
2. copy:
   - **publishable key** (starts with `pk_live_`)
   - **secret key** (starts with `sk_live_`) - click "reveal live key"

## step 5: create production product & price ids

create single product in **live mode**:

1. go to [stripe products](https://dashboard.stripe.com/products) (live mode)
2. create product:

#### baileys analytics
- name: `baileys analytics`
- monthly: `$20.00/month`
- yearly: `$192.00/year` (save 20%)
- copy both price ids

## step 6: configure production secrets

use the automated script:

```bash
cd /Users/nicosalm/dev/dashboard-thing
./scripts/setup-stripe-production.sh
```

or manually set secrets:

```bash
cd apps/workers

# stripe api keys
wrangler secret put STRIPE_SECRET_KEY --env production
# paste: sk_live_YOUR_SECRET_KEY

wrangler secret put STRIPE_PUBLISHABLE_KEY --env production
# paste: pk_live_YOUR_PUBLISHABLE_KEY

wrangler secret put STRIPE_WEBHOOK_SECRET --env production
# paste: whsec_YOUR_WEBHOOK_SECRET

# stripe price ids (2 total)
wrangler secret put STRIPE_PRICE_MONTHLY --env production
# paste: price_YOUR_ID (monthly $20)

wrangler secret put STRIPE_PRICE_YEARLY --env production
# paste: price_YOUR_ID (yearly $192)

# database and supabase (if not already set)
wrangler secret put DATABASE_URL --env production
wrangler secret put SUPABASE_URL --env production
wrangler secret put SUPABASE_SERVICE_KEY --env production
wrangler secret put SUPABASE_ANON_KEY --env production

# ownerrez oauth (if not already set)
wrangler secret put OWNERREZ_CLIENT_ID --env production
wrangler secret put OWNERREZ_CLIENT_SECRET --env production
wrangler secret put OWNERREZ_WEBHOOK_USER --env production
wrangler secret put OWNERREZ_WEBHOOK_PASSWORD --env production
```

## step 7: configure frontend production environment

update pages deployment environment variables:

1. go to cloudflare pages dashboard
2. find `baileys-dashboard` project
3. go to **settings** → **environment variables**
4. add/update for **production**:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
   VITE_API_URL=https://YOUR_WORKER_URL/api
   ```

## step 8: deploy backend

```bash
cd apps/workers
pnpm run deploy:production
```

## step 9: test production webhook

after deployment:

```bash
# test webhook endpoint is accessible
curl https://YOUR_WORKER_URL/api/health

# trigger a test event from stripe dashboard
# go to: https://dashboard.stripe.com/webhooks
# find your webhook and click "send test webhook"
```

## step 10: verification checklist

- [ ] production worker deployed successfully
- [ ] webhook endpoint returns 200 ok in stripe dashboard
- [ ] all environment secrets configured in cloudflare
- [ ] frontend environment variables updated in pages
- [ ] live mode api keys are working
- [ ] test checkout flow with real card (or [stripe test cards](https://stripe.com/docs/testing))
- [ ] subscription appears in settings → billing
- [ ] webhook events show successful in stripe dashboard

## troubleshooting

### webhook returns 401/403
- check webhook secret matches in cloudflare
- verify endpoint url is correct (includes `/api/billing/webhook`)

### checkout fails
- verify price ids are set correctly (2 total: monthly + yearly)
- check stripe api keys are for live mode (not test mode)
- review cloudflare workers logs: `wrangler tail --env production`

### "no active subscription" error
- check webhooks are processing successfully
- verify subscription exists in database
- check tenant has correct subscription_status

## security notes

1. **never commit live api keys** to git
2. **use environment variables** for all sensitive data
3. **rotate keys regularly** in production
4. **monitor webhook events** for suspicious activity
5. **set up alerts** for failed payments

## support resources

- [stripe webhooks documentation](https://stripe.com/docs/webhooks)
- [cloudflare workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [wrangler cli documentation](https://developers.cloudflare.com/workers/wrangler/)
