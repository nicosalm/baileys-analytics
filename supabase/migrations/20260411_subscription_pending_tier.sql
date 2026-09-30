-- Adds pending tier columns so a customer who has outgrown their current plan
-- gets a deterministic "you'll move to X on renewal day" record without any
-- Stripe-side mutation happening on the read path. The displayed tier stays
-- frozen until invoice.payment_succeeded for the new period actually clears,
-- at which point the webhook handler promotes pending_* into the live columns.
-- A daily cron pushes the pending price into Stripe shortly before each
-- renewal, tagging the Stripe subscription with metadata.deferred_tier_change
-- so the in-flight customer.subscription.updated webhook knows to suppress the
-- displayed tier change until billing actually happens.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_tier text,
  ADD COLUMN IF NOT EXISTS pending_price_id text,
  ADD COLUMN IF NOT EXISTS pending_unit_amount integer,
  ADD COLUMN IF NOT EXISTS pending_effective_at timestamptz;

COMMENT ON COLUMN public.subscriptions.pending_tier IS 'Resolved tier slug the customer will be moved to at next renewal. Set by lazy reconciliation when property count exceeds current tier limit. Cleared when applied or when overage clears.';
COMMENT ON COLUMN public.subscriptions.pending_price_id IS 'Stripe price id corresponding to pending_tier + current billing cycle.';
COMMENT ON COLUMN public.subscriptions.pending_unit_amount IS 'Cents-per-period that will be charged once pending_tier applies. Stored so the UI can show the upcoming price without recomputing.';
COMMENT ON COLUMN public.subscriptions.pending_effective_at IS 'Timestamp at or after which the cron is allowed to push pending_price_id into Stripe. Set to current_period_end of the subscription at the time the pending row was created.';

CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_apply
  ON public.subscriptions (pending_effective_at)
  WHERE pending_tier IS NOT NULL;
