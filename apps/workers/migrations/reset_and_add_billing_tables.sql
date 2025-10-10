-- Complete Billing System Reset and Recreation Migration
-- This migration drops all existing billing tables and recreates them with correct schema
-- Run this to ensure clean billing system setup

-- ============================================
-- STEP 1: DROP EXISTING TABLES AND POLICIES
-- ============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Service role full access" ON subscription_plans;
DROP POLICY IF EXISTS "Service role full access" ON stripe_customers;
DROP POLICY IF EXISTS "Service role full access" ON subscriptions;
DROP POLICY IF EXISTS "Service role full access" ON payment_methods;
DROP POLICY IF EXISTS "Service role full access" ON billing_history;
DROP POLICY IF EXISTS "Service role full access" ON usage_metrics;
DROP POLICY IF EXISTS "Public read subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Users can view their own billing data" ON stripe_customers;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view their own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can view their own billing history" ON billing_history;
DROP POLICY IF EXISTS "Users can view their own usage metrics" ON usage_metrics;

-- Drop triggers
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
DROP TRIGGER IF EXISTS update_stripe_customers_updated_at ON stripe_customers;
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
DROP TRIGGER IF EXISTS update_billing_history_updated_at ON billing_history;
DROP TRIGGER IF EXISTS update_usage_metrics_updated_at ON usage_metrics;

-- Drop functions
DROP FUNCTION IF EXISTS check_subscription_status(UUID);

-- Drop indexes
DROP INDEX IF EXISTS idx_subscriptions_tenant_id;
DROP INDEX IF EXISTS idx_subscriptions_status;
DROP INDEX IF EXISTS idx_stripe_customers_tenant_id;
DROP INDEX IF EXISTS idx_billing_history_tenant_id;
DROP INDEX IF EXISTS idx_billing_history_created;
DROP INDEX IF EXISTS idx_usage_metrics_tenant_id;
DROP INDEX IF EXISTS idx_usage_metrics_period;
DROP INDEX IF EXISTS idx_stripe_customers_tenant;
DROP INDEX IF EXISTS idx_subscriptions_tenant;
DROP INDEX IF EXISTS idx_payment_methods_tenant;
DROP INDEX IF EXISTS idx_billing_history_tenant;
DROP INDEX IF EXISTS idx_usage_metrics_tenant_period;
DROP INDEX IF EXISTS idx_webhook_events_event_id;
DROP INDEX IF EXISTS idx_webhook_events_processed;

-- Drop tables in correct order (respect foreign key constraints)
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS usage_metrics CASCADE;
DROP TABLE IF EXISTS billing_history CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS stripe_customers CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- Drop columns from tenants table if they exist
ALTER TABLE tenants
DROP COLUMN IF EXISTS subscription_status,
DROP COLUMN IF EXISTS trial_ends_at,
DROP COLUMN IF EXISTS subscription_ends_at;

-- ============================================
-- STEP 2: CREATE TABLES WITH CORRECT SCHEMA
-- ============================================

-- Create extension if not exists (for UUID generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Subscription plans table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  stripe_price_id VARCHAR(255) UNIQUE,
  price_monthly INTEGER NOT NULL, -- in cents
  price_yearly INTEGER NOT NULL, -- in cents
  max_properties INTEGER NOT NULL DEFAULT -1, -- -1 for unlimited
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Stripe customers table
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id)
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL,
  plan_id UUID REFERENCES subscription_plans(id),
  status VARCHAR(50) NOT NULL, -- active, trialing, past_due, canceled, incomplete, incomplete_expired
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id)
);

-- Payment methods table
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50), -- card, bank_account, etc.
  card_brand VARCHAR(50), -- visa, mastercard, amex, discover
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Billing history table
CREATE TABLE billing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  amount INTEGER NOT NULL, -- in cents
  amount_paid INTEGER, -- actual amount paid (may differ due to credits/discounts)
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL, -- paid, failed, pending, refunded, partially_refunded
  description TEXT,
  invoice_pdf TEXT,
  hosted_invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Usage metrics table for tracking and limiting usage
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL, -- api_calls, reports_generated, active_properties, data_syncs
  count INTEGER DEFAULT 0,
  limit_amount INTEGER, -- NULL means no limit
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, metric_type, period_start, period_end)
);

-- Webhook events table for idempotency and debugging
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

-- Add subscription-related columns to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- ============================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_stripe_customers_tenant_id ON stripe_customers(tenant_id);
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_payment_methods_tenant_id ON payment_methods(tenant_id);
CREATE INDEX idx_billing_history_tenant_id ON billing_history(tenant_id);
CREATE INDEX idx_billing_history_created ON billing_history(created_at DESC);
CREATE INDEX idx_billing_history_status ON billing_history(status);
CREATE INDEX idx_usage_metrics_tenant_id ON usage_metrics(tenant_id);
CREATE INDEX idx_usage_metrics_period ON usage_metrics(period_start, period_end);
CREATE INDEX idx_usage_metrics_type ON usage_metrics(metric_type);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);

-- ============================================
-- STEP 4: INSERT DEFAULT SUBSCRIPTION PLANS
-- ============================================

-- Insert plans with correct pricing (20% yearly discount)
INSERT INTO subscription_plans (
  name,
  stripe_price_id,
  price_monthly,
  price_yearly,
  max_properties,
  features,
  sort_order,
  is_active
) VALUES
  (
    'Starter',
    'price_starter_monthly_placeholder',
    1900, -- $19/month
    18240, -- $182.40/year (true 20% off: $19 * 12 * 0.8)
    3,
    '{
      "dashboards": ["core"],
      "real_time_sync": true,
      "monthly_yearly_views": true,
      "email_support": true,
      "api_calls": 10000,
      "reports": 50,
      "data_exports": true,
      "basic_analytics": true
    }'::jsonb,
    1,
    true
  ),
  (
    'Professional',
    'price_professional_monthly_placeholder',
    4900, -- $49/month
    47040, -- $470.40/year (true 20% off: $49 * 12 * 0.8)
    15,
    '{
      "dashboards": ["all"],
      "tax_tracking": true,
      "guest_analytics": true,
      "occupancy_gap_detection": true,
      "priority_support": true,
      "api_calls": 50000,
      "reports": -1,
      "data_exports": true,
      "advanced_analytics": true,
      "custom_reports": true,
      "season_management": true,
      "revenue_forecasting": true
    }'::jsonb,
    2,
    true
  ),
  (
    'Scale',
    'price_scale_monthly_placeholder',
    9900, -- $99/month
    95040, -- $950.40/year (true 20% off: $99 * 12 * 0.8)
    -1, -- unlimited
    '{
      "dashboards": ["all"],
      "custom_integrations": true,
      "white_label": true,
      "dedicated_account_manager": true,
      "sla": true,
      "phone_support": true,
      "api_calls": -1,
      "reports": -1,
      "data_exports": true,
      "advanced_analytics": true,
      "custom_reports": true,
      "season_management": true,
      "revenue_forecasting": true,
      "api_access": true,
      "bulk_operations": true,
      "multi_user": true,
      "audit_logs": true
    }'::jsonb,
    3,
    true
  )
ON CONFLICT (stripe_price_id) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  updated_at = CURRENT_TIMESTAMP;

-- Also insert yearly price placeholders
INSERT INTO subscription_plans (
  name,
  stripe_price_id,
  price_monthly,
  price_yearly,
  max_properties,
  features,
  sort_order,
  is_active
) VALUES
  ('Starter (Yearly)', 'price_starter_yearly_placeholder', 1520, 18240, 3,
   (SELECT features FROM subscription_plans WHERE name = 'Starter'), 1, true),
  ('Professional (Yearly)', 'price_professional_yearly_placeholder', 3920, 47040, 15,
   (SELECT features FROM subscription_plans WHERE name = 'Professional'), 2, true),
  ('Scale (Yearly)', 'price_scale_yearly_placeholder', 7920, 95040, -1,
   (SELECT features FROM subscription_plans WHERE name = 'Scale'), 3, true)
ON CONFLICT (stripe_price_id) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  features = EXCLUDED.features,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- STEP 5: CREATE ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all billing tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access to everything
CREATE POLICY "Service role full access" ON subscription_plans
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON stripe_customers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON payment_methods
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON billing_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON usage_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- Public can read active subscription plans
CREATE POLICY "Public read active plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- Authenticated users can view their own data
CREATE POLICY "Users view own customer data" ON stripe_customers
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users view own payment methods" ON payment_methods
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users view own billing history" ON billing_history
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users view own usage metrics" ON usage_metrics
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- ============================================
-- STEP 6: CREATE UTILITY FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_history_updated_at
  BEFORE UPDATE ON billing_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_metrics_updated_at
  BEFORE UPDATE ON usage_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check subscription status
CREATE OR REPLACE FUNCTION check_subscription_status(p_tenant_id UUID)
RETURNS TABLE(
  is_active BOOLEAN,
  status VARCHAR(50),
  plan_name VARCHAR(100),
  plan_id UUID,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  max_properties INTEGER,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.status IN ('active', 'trialing') as is_active,
    s.status,
    sp.name as plan_name,
    sp.id as plan_id,
    s.trial_end as trial_ends_at,
    s.current_period_end,
    sp.max_properties,
    sp.features
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.tenant_id = p_tenant_id
    AND s.status NOT IN ('canceled', 'incomplete_expired')
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to track usage
CREATE OR REPLACE FUNCTION track_usage(
  p_tenant_id UUID,
  p_metric_type VARCHAR(50),
  p_count INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  -- Calculate current billing period (monthly)
  v_period_start := date_trunc('month', CURRENT_TIMESTAMP);
  v_period_end := date_trunc('month', CURRENT_TIMESTAMP + interval '1 month') - interval '1 second';

  -- Insert or update usage metric
  INSERT INTO usage_metrics (
    tenant_id,
    metric_type,
    count,
    period_start,
    period_end
  ) VALUES (
    p_tenant_id,
    p_metric_type,
    p_count,
    v_period_start,
    v_period_end
  )
  ON CONFLICT (tenant_id, metric_type, period_start, period_end)
  DO UPDATE SET
    count = usage_metrics.count + p_count,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant is within grace period
CREATE OR REPLACE FUNCTION is_in_grace_period(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_created_at TIMESTAMPTZ;
  v_grace_period_ends TIMESTAMPTZ;
  v_has_subscription BOOLEAN;
BEGIN
  -- Get tenant creation date
  SELECT created_at, grace_period_ends_at
  INTO v_created_at, v_grace_period_ends
  FROM tenants
  WHERE id = p_tenant_id;

  -- Check if tenant has ever had a subscription
  SELECT EXISTS(
    SELECT 1 FROM subscriptions
    WHERE tenant_id = p_tenant_id
  ) INTO v_has_subscription;

  -- If tenant has had a subscription before, no grace period
  IF v_has_subscription THEN
    RETURN FALSE;
  END IF;

  -- Check if custom grace period is set
  IF v_grace_period_ends IS NOT NULL THEN
    RETURN CURRENT_TIMESTAMP < v_grace_period_ends;
  END IF;

  -- Default: 1 day grace period for new accounts
  RETURN CURRENT_TIMESTAMP < (v_created_at + interval '1 day');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 7: GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON subscription_plans TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION check_subscription_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION track_usage(UUID, VARCHAR, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION is_in_grace_period(UUID) TO service_role;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration by checking tables exist
DO $$
DECLARE
  v_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'subscription_plans',
      'stripe_customers',
      'subscriptions',
      'payment_methods',
      'billing_history',
      'usage_metrics',
      'webhook_events'
    );

  IF v_table_count = 7 THEN
    RAISE NOTICE 'Migration completed successfully! All 7 billing tables created.';
  ELSE
    RAISE WARNING 'Migration may have issues. Expected 7 tables, found %', v_table_count;
  END IF;
END $$;