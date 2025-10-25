-- Add performance index for first_subscription_at column
-- This speeds up trial eligibility checks and subscription queries

-- Partial index: only indexes rows where first_subscription_at is NOT NULL
-- More efficient since we're checking if tenants HAVE subscribed
CREATE INDEX IF NOT EXISTS idx_tenants_first_subscription
ON tenants(first_subscription_at)
WHERE first_subscription_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_tenants_first_subscription IS 'Partial index for trial eligibility queries - only indexes tenants who have subscribed';

-- Verification query:
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE indexname = 'idx_tenants_first_subscription';
