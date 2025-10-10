# Stripe Billing Integration Setup

This guide covers the complete setup of the Stripe billing integration for the Baileys Analytics platform.

## Environment Variables

### Frontend (apps/web)

Add to `.env`:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key-here
```

### Backend (apps/workers)

Add the following secrets using Wrangler CLI:

```bash
# Stripe API keys
wrangler secret put STRIPE_SECRET_KEY
# Enter: sk_test_your-secret-key-here

wrangler secret put STRIPE_WEBHOOK_SECRET
# Enter: whsec_your-webhook-secret-here

# Stripe Price IDs for each plan and billing cycle
# Starter Plan
wrangler secret put STRIPE_PRICE_STARTER_MONTHLY
# Enter: price_xxx (for $19/month)

wrangler secret put STRIPE_PRICE_STARTER_YEARLY
# Enter: price_xxx (for $192/year)

# Professional Plan
wrangler secret put STRIPE_PRICE_PROFESSIONAL_MONTHLY
# Enter: price_xxx (for $49/month)

wrangler secret put STRIPE_PRICE_PROFESSIONAL_YEARLY
# Enter: price_xxx (for $468/year)

# Scale Plan
wrangler secret put STRIPE_PRICE_SCALE_MONTHLY
# Enter: price_xxx (for $99/month)

wrangler secret put STRIPE_PRICE_SCALE_YEARLY
# Enter: price_xxx (for $948/year)
```

For production deployment:
```bash
wrangler secret put STRIPE_SECRET_KEY --env production
# Repeat for all secrets with --env production flag
```

## Stripe Product Configuration

### 1. Create Products in Stripe Dashboard

Create three products with the following configurations:

#### Starter Plan
- **Name**: Baileys Starter
- **Description**: Perfect for 1-3 properties
- **Monthly Price**: $19.00
- **Yearly Price**: $192.00 (20% discount)
- **Features**:
  - Core analytics dashboard
  - Real-time sync
  - Monthly & yearly views
  - Email support

#### Professional Plan
- **Name**: Baileys Professional
- **Description**: Ideal for 4-15 properties
- **Monthly Price**: $49.00
- **Yearly Price**: $468.00 (20% discount)
- **Features**:
  - Everything in Starter
  - Advanced tax tracking & reports
  - Guest history & analytics
  - Occupancy gap detection
  - Priority support

#### Scale Plan
- **Name**: Baileys Scale
- **Description**: Built for 16+ properties
- **Monthly Price**: $99.00+
- **Yearly Price**: $948.00+ (20% discount)
- **Features**:
  - Everything in Professional
  - Custom integrations
  - White-label options
  - Dedicated account manager
  - SLA & phone support

### 2. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint:
   - **Endpoint URL**: `https://your-api.workers.dev/api/billing/webhook`
   - **Events to listen for**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
3. Save the webhook signing secret as `STRIPE_WEBHOOK_SECRET`

### 3. Configure Customer Portal

1. Go to Stripe Dashboard → Settings → Billing → Customer portal
2. Enable the following features:
   - Update payment methods
   - Cancel subscriptions
   - View invoices
   - Switch plans
3. Set cancellation policy:
   - Immediate cancellation
   - No proration on downgrades
4. Save configuration

## Database Setup

Run the migration to create billing tables:

```bash
# Connect to your Supabase database
psql $DATABASE_URL -f apps/workers/migrations/add_billing_tables.sql
```

## First Month $1 Pricing Structure

The integration implements a special $1 first month offer for new customers:

1. **New Customer Flow**:
   - User signs up and selects a plan
   - Pays $1 immediately (setup fee)
   - Gets 30-day trial period at $0/month
   - After 30 days, regular subscription pricing begins

2. **Implementation Details**:
   - The $1 is charged as a one-time setup fee
   - Subscription starts with a 30-day trial at $0
   - Card is required and saved for future charges
   - After trial, regular monthly/yearly pricing applies

3. **Existing Customer Flow**:
   - Can switch plans through the customer portal
   - No $1 offer (regular pricing applies immediately)
   - Proration handled automatically by Stripe

## Testing

### Test Cards

Use these test cards in Stripe's test mode:

- **Success**: `4242 4242 4242 4242`
- **Declined**: `4000 0000 0000 0002`
- **Authentication Required**: `4000 0025 0000 3155`

### Test Scenarios

1. **New User Signup with $1 First Month**:
   ```
   1. Sign up for new account
   2. Select any plan
   3. Enter test card
   4. Verify $1 charge
   5. Check subscription status in Settings
   ```

2. **Plan Upgrade/Downgrade**:
   ```
   1. Go to Settings → Billing
   2. Click "Manage Subscription"
   3. Select new plan
   4. Verify proration
   ```

3. **Subscription Cancellation**:
   ```
   1. Go to Settings → Billing
   2. Click "Manage Subscription"
   3. Cancel subscription
   4. Verify access continues until period end
   ```

4. **Failed Payment**:
   ```
   1. Use declining test card
   2. Verify error handling
   3. Check subscription status
   ```

## Monitoring

### Key Metrics to Track

1. **Subscription Metrics**:
   - New subscriptions per day
   - Churn rate
   - MRR (Monthly Recurring Revenue)
   - Plan distribution

2. **Payment Metrics**:
   - Success rate
   - Failed payments
   - Recovery rate

3. **Usage Metrics** (tracked in `usage_metrics` table):
   - API calls per tenant
   - Properties per tenant
   - Reports generated

### Webhook Monitoring

Monitor webhook events in Stripe Dashboard:
- Check for failed webhooks
- Review event logs
- Set up alerts for failures

## Troubleshooting

### Common Issues

1. **"No active subscription" error**:
   - Check if tenant has subscription in database
   - Verify subscription status is 'active' or 'trialing'
   - Check if within grace period (1 day for new accounts)

2. **Webhook signature verification failed**:
   - Verify `STRIPE_WEBHOOK_SECRET` is correct
   - Check endpoint URL matches exactly
   - Ensure raw request body is used for verification

3. **Checkout session fails to create**:
   - Verify all Stripe Price IDs are configured
   - Check Stripe API key is valid
   - Review error logs in Cloudflare dashboard

4. **Customer portal not loading**:
   - Ensure customer has Stripe customer record
   - Verify portal is configured in Stripe
   - Check return URL is correct

## Security Considerations

1. **Never expose secret keys**:
   - Use environment variables
   - Never commit keys to git
   - Rotate keys regularly

2. **Webhook verification**:
   - Always verify webhook signatures
   - Use webhook secrets
   - Validate event data

3. **Access control**:
   - Subscription middleware protects dashboard routes
   - Billing routes require authentication
   - Webhook endpoint is public but verified

## Support

For issues or questions:
- Check Stripe logs in dashboard
- Review Cloudflare Workers logs
- Contact support with tenant ID and timestamp