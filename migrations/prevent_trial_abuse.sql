-- Prevent $1 trial abuse by tracking first subscription date
-- This ensures users can only get the $1 trial once per tenant account

-- Add first_subscription_at column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS first_subscription_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Backfill existing subscribers with their earliest subscription date
-- Use the created_at from subscriptions table as the first subscription date
UPDATE tenants t
SET first_subscription_at = (
    SELECT MIN(s.created_at)
    FROM subscriptions s
    WHERE s.tenant_id = t.id
)
WHERE EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.tenant_id = t.id
)
AND first_subscription_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN tenants.first_subscription_at IS 'Timestamp when tenant first subscribed (used to prevent trial abuse)';

-- Verification query to check results:
-- SELECT id, email, first_subscription_at, subscription_status
-- FROM tenants
-- WHERE first_subscription_at IS NOT NULL
-- ORDER BY first_subscription_at DESC
-- LIMIT 10;
