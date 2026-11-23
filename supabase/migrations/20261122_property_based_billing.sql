-- apply before deploying the worker from the same commit: the new reconciliation reads and
-- writes these columns, and against the old schema it quietly stops recording changes.
--
-- plans now follow the active property count in both directions at renewal, customers can
-- switch between monthly and yearly at renewal, and each upcoming change is emailed once.
-- the worker uses the service role, so no grants are needed (see 20261121).

alter table public.subscriptions
  add column if not exists preferred_billing_cycle text check (preferred_billing_cycle in ('monthly', 'yearly')),
  add column if not exists pending_notified_at timestamptz,
  add column if not exists contact_sales_notified_at timestamptz;

comment on column public.subscriptions.preferred_billing_cycle is 'Billing cycle the customer asked to switch to at the next renewal. Null when it matches billing_cycle. Cleared once the renewal invoice is paid.';
comment on column public.subscriptions.pending_notified_at is 'When the customer was emailed about the pending tier or cycle change. Cleared whenever the pending change is rewritten or removed.';
comment on column public.subscriptions.contact_sales_notified_at is 'When ops was alerted that the tenant has 20 or more active properties. Cleared when the count drops below 20.';
comment on column public.subscriptions.pending_tier is 'Tier the next renewal bills, up or down from the current tier, set by reconciliation from the active property count. Cleared when applied or no longer needed.';
comment on column public.subscriptions.pending_price_id is 'Stripe price id for pending_tier at the target billing cycle (preferred_billing_cycle, else billing_cycle).';
