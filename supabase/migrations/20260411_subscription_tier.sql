-- Adds tier, unit_amount, and stripe_price_id columns to subscriptions so the
-- billing UI can display the actual plan name and amount per customer instead
-- of hardcoded values. Backfill happens lazily on first /billing/subscription
-- read for any subscription with a null tier.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS unit_amount integer,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

COMMENT ON COLUMN public.subscriptions.tier IS 'Tier slug from Stripe price metadata: starter, growth, portfolio, or legacy for grandfathered customers';
COMMENT ON COLUMN public.subscriptions.unit_amount IS 'Actual cents charged per billing period (from Stripe price.unit_amount)';
COMMENT ON COLUMN public.subscriptions.stripe_price_id IS 'Stripe price ID currently attached to the subscription';
