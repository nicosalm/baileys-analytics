# database cleanup for single-tier migration

## what needs to be fixed

your database schema still has multi-tier references that need cleanup:

### required changes
1. **add `billing_cycle` column** to `subscriptions` table
2. **make `plan_id` nullable** (no longer used)
3. **update existing subscriptions** to set billing_cycle

### optional cleanup
4. **drop `subscription_plans` table** entirely (if you want full cleanup)

## how to apply

### option 1: run migration file (recommended)

```bash
# connect to your production database
psql $DATABASE_URL -f apps/workers/migrations/single_tier_migration.sql
```

### option 2: manual sql commands

connect to your supabase database and run:

```sql
-- add billing_cycle column
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(10) DEFAULT 'monthly';

-- make plan_id nullable
ALTER TABLE subscriptions
ALTER COLUMN plan_id DROP NOT NULL;

-- add check constraint
ALTER TABLE subscriptions
ADD CONSTRAINT billing_cycle_check
CHECK (billing_cycle IN ('monthly', 'yearly'));

-- create index
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_cycle
ON subscriptions(billing_cycle);

-- update existing subscriptions (all to monthly for now)
UPDATE subscriptions
SET billing_cycle = 'monthly'
WHERE billing_cycle IS NULL;
```

### option 3: use supabase dashboard

1. go to supabase dashboard → sql editor
2. copy/paste the migration file contents
3. click "run"

## verify changes

after running migration:

```sql
-- check schema
\d subscriptions

-- verify billing_cycle is populated
SELECT billing_cycle, status, COUNT(*)
FROM subscriptions
GROUP BY billing_cycle, status;

-- check for any null billing_cycles
SELECT COUNT(*) FROM subscriptions WHERE billing_cycle IS NULL;
```

## what happens to existing subscriptions?

- **all existing subscriptions** will default to `billing_cycle = 'monthly'`
- if you know some are yearly, update them manually:
  ```sql
  UPDATE subscriptions
  SET billing_cycle = 'yearly'
  WHERE tenant_id IN ('tenant-id-1', 'tenant-id-2');
  ```
- **new subscriptions** will automatically get correct billing_cycle from stripe webhooks

## dropping old tables (optional)

if you want to fully remove multi-tier infrastructure:

```sql
-- this will remove all plan references
DROP TABLE IF EXISTS subscription_plans CASCADE;
```

⚠️ **warning**: only do this if:
- you've migrated all subscriptions
- you don't need historical plan data
- you're confident you won't roll back

## checking production database

to see current state:

```sql
-- check if billing_cycle column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subscriptions';

-- check for subscription_plans table
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'subscription_plans';

-- see current subscriptions
SELECT
  tenant_id,
  status,
  plan_id,
  stripe_subscription_id,
  current_period_end
FROM subscriptions
ORDER BY created_at DESC
LIMIT 10;
```

## rollback (if needed)

if something goes wrong:

```sql
-- remove billing_cycle column
ALTER TABLE subscriptions DROP COLUMN IF EXISTS billing_cycle;

-- make plan_id required again
ALTER TABLE subscriptions ALTER COLUMN plan_id SET NOT NULL;
```

## support

- check supabase logs for any errors
- verify stripe webhooks are still working after changes
- test a new subscription signup to ensure billing_cycle is set correctly
