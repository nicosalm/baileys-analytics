-- Add subscription_exempt column to tenants table
-- This allows granting free access to select accounts without requiring Stripe subscriptions

-- Add the column
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS subscription_exempt boolean DEFAULT false;

-- Add a comment explaining the purpose
COMMENT ON COLUMN tenants.subscription_exempt IS 'If true, this account bypasses all subscription checks and has free unlimited access';

-- Optional: Mark the demo account as exempt
-- UPDATE tenants SET subscription_exempt = true WHERE email = 'demo@baileysanalytics.com';
-- Or by tenant ID:
-- UPDATE tenants SET subscription_exempt = true WHERE id = 'df2d602d-0472-4ccc-bcfd-374de378a175';

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_exempt ON tenants(subscription_exempt) WHERE subscription_exempt = true;
