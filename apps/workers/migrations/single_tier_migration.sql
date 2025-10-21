-- migration: single-tier billing cleanup
-- removes multi-tier plan references and adds billing_cycle tracking

-- step 1: add billing_cycle column to subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(10) DEFAULT 'monthly';

-- step 2: update existing subscriptions to infer billing_cycle
-- (attempt to determine from metadata or default to monthly)
UPDATE subscriptions
SET billing_cycle = CASE
  WHEN metadata->>'first_month_promo' = 'true' THEN 'monthly'
  ELSE 'monthly'
END
WHERE billing_cycle IS NULL;

-- step 3: make plan_id nullable (no longer required)
ALTER TABLE subscriptions
ALTER COLUMN plan_id DROP NOT NULL;

-- step 4: add check constraint to billing_cycle
ALTER TABLE subscriptions
ADD CONSTRAINT billing_cycle_check
CHECK (billing_cycle IN ('monthly', 'yearly'));

-- step 5: create index on billing_cycle for reporting
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_cycle
ON subscriptions(billing_cycle);

-- optional: drop subscription_plans table entirely
-- uncomment if you want to fully remove multi-tier infrastructure
-- DROP TABLE IF EXISTS subscription_plans CASCADE;

-- verification queries
-- check subscriptions without billing_cycle
SELECT COUNT(*) as missing_billing_cycle
FROM subscriptions
WHERE billing_cycle IS NULL;

-- check current billing cycle distribution
SELECT
  billing_cycle,
  status,
  COUNT(*) as count
FROM subscriptions
GROUP BY billing_cycle, status
ORDER BY billing_cycle, status;

-- list any subscriptions still referencing plans
SELECT
  id,
  tenant_id,
  plan_id,
  billing_cycle,
  status
FROM subscriptions
WHERE plan_id IS NOT NULL
LIMIT 10;
