CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    company_name VARCHAR(255),
    ownerrez_user_id VARCHAR(50) UNIQUE,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    tenant_id UUID REFERENCES tenants(id),
    company_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenants
ADD CONSTRAINT fk_tenants_user_id FOREIGN KEY (user_id) REFERENCES users(id);

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ownerrez_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    bedrooms INTEGER,
    bathrooms INTEGER,
    max_guests INTEGER,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    thumbnail_url TEXT,
    public_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, ownerrez_id)
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    ownerrez_booking_id VARCHAR(50) NOT NULL,
    arrival DATE NOT NULL,
    departure DATE NOT NULL,
    adults INTEGER DEFAULT 0,
    children INTEGER DEFAULT 0,
    infants INTEGER DEFAULT 0,
    pets INTEGER DEFAULT 0,
    guest_name VARCHAR(255),
    guest_email VARCHAR(255),
    total_amount DECIMAL(10, 2),
    status VARCHAR(50),
    platform VARCHAR(100),
    platform_reservation_number VARCHAR(100),
    booked_utc TIMESTAMP WITH TIME ZONE,
    canceled_utc TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, ownerrez_booking_id)
);

CREATE TABLE booking_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    is_taxable BOOLEAN DEFAULT false,
    tax_id VARCHAR(50),
    position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform_name VARCHAR(100) NOT NULL,
    fee_type VARCHAR(50) NOT NULL DEFAULT 'percentage',
    fee_value DECIMAL(10, 4) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, platform_name, effective_from)
);

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    parent_category_id UUID REFERENCES expense_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id),
    property_id UUID REFERENCES properties(id),
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    expense_date DATE NOT NULL,
    vendor_name VARCHAR(255),
    invoice_number VARCHAR(100),
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50),
    booking_id UUID REFERENCES bookings(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id),
    allocation_percentage DECIMAL(5, 2) NOT NULL,
    allocated_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (expense_id, property_id)
);

CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id),
    property_id UUID REFERENCES properties(id),
    budget_year INTEGER NOT NULL,
    budget_month INTEGER,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, category_id, property_id, budget_year, budget_month)
);

CREATE TABLE tax_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    rate DECIMAL(5, 4) NOT NULL,
    type VARCHAR(50),
    applies_to_properties UUID[] DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tax_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    method JSONB NOT NULL,
    applies_to JSONB NOT NULL,
    jurisdiction VARCHAR(255),
    effective_from DATE NOT NULL,
    effective_to DATE,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tax_rules_unique_name UNIQUE (tenant_id, name)
);

CREATE TABLE tax_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    total_tax DECIMAL(10, 2) NOT NULL,
    effective_rate DECIMAL(5, 4) NOT NULL,
    applied_rules JSONB NOT NULL,
    breakdown JSONB NOT NULL,
    calculation_context JSONB NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform fee tracking for accurate tax calculations
CREATE TABLE platform_fee_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    guest_service_fee DECIMAL(10, 2) DEFAULT 0,
    host_service_fee DECIMAL(10, 2) DEFAULT 0,
    platform_remits_tax BOOLEAN DEFAULT false,
    platform_tax_remitted DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, property_id, platform, month)
);

-- Property tax configuration for jurisdiction-specific rules
CREATE TABLE property_tax_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_name VARCHAR(255) NOT NULL,
    jurisdictions JSONB NOT NULL, -- Array of {name, rate, type}
    taxable_items JSONB NOT NULL, -- Array of taxable item types
    platform_settings JSONB NOT NULL, -- Platform-specific tax handling
    is_active BOOLEAN DEFAULT true,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, config_name)
);

-- Tax remittance tracking
CREATE TABLE tax_remittances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,
    total_platform_fees DECIMAL(10, 2) DEFAULT 0,
    total_tax_due DECIMAL(10, 2) NOT NULL,
    platform_remitted DECIMAL(10, 2) DEFAULT 0,
    owner_remitted DECIMAL(10, 2) NOT NULL,
    filing_status VARCHAR(50) DEFAULT 'pending', -- pending, filed, paid, overdue
    filed_date DATE,
    confirmation_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ownerrez_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, ownerrez_id)
);

CREATE TABLE property_tags (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (property_id, tag_id)
);

CREATE TABLE booking_tags (
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (booking_id, tag_id)
);

CREATE TABLE oauth_states (
    state VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id)
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sync_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_items INTEGER,
    processed_items INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO platform_fees (tenant_id, platform_name, fee_type, fee_value, effective_from) VALUES
('00000000-0000-0000-0000-000000000000', 'airbnb', 'percentage', 0.03, '2024-01-01'),
('00000000-0000-0000-0000-000000000000', 'vrbo', 'percentage', 0.05, '2024-01-01'),
('00000000-0000-0000-0000-000000000000', 'booking.com', 'percentage', 0.15, '2024-01-01'),
('00000000-0000-0000-0000-000000000000', 'direct', 'percentage', 0.00, '2024-01-01')
ON CONFLICT DO NOTHING;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_properties_tenant_id ON properties(tenant_id);
CREATE INDEX idx_properties_active ON properties(tenant_id, active);
CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_property_id ON bookings(property_id);
CREATE INDEX idx_bookings_arrival_departure ON bookings(tenant_id, arrival, departure);
CREATE INDEX idx_bookings_guest ON bookings(tenant_id, guest_name, guest_email);
CREATE INDEX idx_bookings_status ON bookings(tenant_id, status);
CREATE INDEX idx_booking_charges_booking_id ON booking_charges(booking_id);
CREATE INDEX idx_booking_charges_type ON booking_charges(booking_id, type);
CREATE INDEX idx_platform_fees_lookup ON platform_fees(tenant_id, platform_name, is_active, effective_from, effective_to);
CREATE INDEX idx_expenses_tenant_date ON expenses(tenant_id, expense_date);
CREATE INDEX idx_expenses_property ON expenses(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_booking ON expenses(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_expense_allocations_property ON expense_allocations(property_id);
CREATE INDEX idx_budgets_tenant_year ON budgets(tenant_id, budget_year);
CREATE INDEX idx_tax_configs_tenant_id ON tax_configs(tenant_id);
CREATE INDEX idx_tax_rules_tenant_active ON tax_rules(tenant_id, is_active);
CREATE INDEX idx_tax_rules_priority ON tax_rules(priority DESC);
CREATE INDEX idx_tax_rules_effective_dates ON tax_rules(effective_from, effective_to);
CREATE INDEX idx_tax_rules_applies_to ON tax_rules USING GIN (applies_to);
CREATE INDEX idx_tax_calculations_tenant_booking ON tax_calculations(tenant_id, booking_id);
CREATE INDEX idx_tax_calculations_calculated_at ON tax_calculations(calculated_at);
CREATE INDEX idx_platform_fee_entries_lookup ON platform_fee_entries(tenant_id, property_id, platform, month);
CREATE INDEX idx_platform_fee_entries_booking ON platform_fee_entries(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_property_tax_configs_property ON property_tax_configs(property_id, is_active);
CREATE INDEX idx_property_tax_configs_effective ON property_tax_configs(effective_from, effective_to);
CREATE INDEX idx_tax_remittances_tenant_period ON tax_remittances(tenant_id, period_start, period_end);
CREATE INDEX idx_tax_remittances_status ON tax_remittances(filing_status) WHERE filing_status != 'paid';
CREATE INDEX idx_tags_tenant_id ON tags(tenant_id);
CREATE INDEX idx_tags_name ON tags(tenant_id, name);
CREATE INDEX idx_property_tags_property_id ON property_tags(property_id);
CREATE INDEX idx_property_tags_tag_id ON property_tags(tag_id);
CREATE INDEX idx_booking_tags_booking_id ON booking_tags(booking_id);
CREATE INDEX idx_booking_tags_tag_id ON booking_tags(tag_id);
CREATE INDEX idx_oauth_states_created_at ON oauth_states(created_at);
CREATE INDEX idx_oauth_tokens_tenant_id ON oauth_tokens(tenant_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_sync_progress_tenant_type ON sync_progress(tenant_id, sync_type);
CREATE INDEX idx_sync_progress_status ON sync_progress(status);

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_platform_fees_updated_at BEFORE UPDATE ON platform_fees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON expense_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_configs_updated_at BEFORE UPDATE ON tax_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_rules_updated_at BEFORE UPDATE ON tax_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_platform_fee_entries_updated_at BEFORE UPDATE ON platform_fee_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_property_tax_configs_updated_at BEFORE UPDATE ON property_tax_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_remittances_updated_at BEFORE UPDATE ON tax_remittances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sync_progress_updated_at BEFORE UPDATE ON sync_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Report generation and management tables
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID,
    name VARCHAR(255) NOT NULL,
    format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'excel', 'csv', 'json')),
    size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE,
    data BYTEA NOT NULL
);

CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL,
    schedule JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    schedule JSONB,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_run TIMESTAMP WITH TIME ZONE,
    last_export_url TEXT,
    last_used TIMESTAMP WITH TIME ZONE,
    use_count INTEGER DEFAULT 0
);

CREATE TABLE report_execution_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    recipients JSONB,
    summary TEXT,
    error TEXT,
    duration_ms INTEGER
);

-- Report history table for tracking report template runs
CREATE TABLE report_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    generated_by VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'processing')),
    file_size BIGINT,
    record_count INTEGER,
    delivery_method VARCHAR(50) NOT NULL CHECK (delivery_method IN ('download', 'email', 'api')),
    recipients TEXT[],
    download_url TEXT,
    error_message TEXT,
    metrics JSONB
);

-- Indexes for report tables
CREATE INDEX idx_generated_reports_tenant_id ON generated_reports(tenant_id);
CREATE INDEX idx_generated_reports_expires_at ON generated_reports(expires_at);
CREATE INDEX idx_generated_reports_template_id ON generated_reports(template_id) WHERE template_id IS NOT NULL;

CREATE INDEX idx_scheduled_reports_tenant_id ON scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run) WHERE enabled = true;
CREATE INDEX idx_scheduled_reports_enabled ON scheduled_reports(enabled);
CREATE INDEX idx_scheduled_reports_template_id ON scheduled_reports(template_id);

CREATE INDEX idx_report_templates_tenant_id ON report_templates(tenant_id);
CREATE INDEX idx_report_templates_type ON report_templates(type);
CREATE INDEX idx_report_templates_is_default ON report_templates(is_default) WHERE is_default = true;

-- Indexes for report_history
CREATE INDEX idx_report_history_template_id ON report_history(template_id);
CREATE INDEX idx_report_history_tenant_id ON report_history(tenant_id);
CREATE INDEX idx_report_history_generated_at ON report_history(generated_at DESC);

CREATE INDEX idx_report_execution_log_report_id ON report_execution_log(report_id);
CREATE INDEX idx_report_execution_log_executed_at ON report_execution_log(executed_at);
CREATE INDEX idx_report_execution_log_status ON report_execution_log(status);

-- Triggers for report tables
CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ENHANCED TAX SYSTEM FOR GENERALIZED TAX MANAGEMENT
-- =====================================================

-- Tax formula configurations (flexible formulas for any jurisdiction)
CREATE TABLE IF NOT EXISTS tax_formulas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    jurisdiction_type VARCHAR(50), -- 'state', 'county', 'city', 'special_district'
    jurisdiction_name VARCHAR(255),
    
    -- What components to include in tax calculation
    taxable_components JSONB DEFAULT '{
        "base_revenue": true,
        "cleaning_fees": false,
        "pet_fees": false,
        "other_fees": false,
        "platform_guest_fees": false,
        "platform_host_fees": false,
        "credit_card_fees": false
    }'::jsonb,
    
    -- How to calculate tax
    calculation_method VARCHAR(50) DEFAULT 'percentage', -- 'percentage', 'flat', 'tiered', 'custom'
    base_rate DECIMAL(5, 4), -- For simple percentage
    calculation_rules JSONB, -- For complex rules (tiers, conditions, etc)
    custom_formula TEXT, -- For advanced users who need specific formulas
    
    -- Platform-specific remittance rules
    remittance_rules JSONB DEFAULT '{
        "airbnb": {
            "remits_on_their_fees": false,
            "remits_on_host_revenue": false,
            "remittance_rate": null
        },
        "vrbo": {
            "remits_on_their_fees": false,
            "remits_on_host_revenue": false,
            "remittance_rate": null
        }
    }'::jsonb,
    
    -- Reporting requirements
    reporting_requirements JSONB DEFAULT '{
        "split_bookings_across_months": true,
        "requires_occupancy_data": false,
        "requires_guest_counts": false,
        "custom_metrics": []
    }'::jsonb,
    
    is_active BOOLEAN DEFAULT true,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tax report configurations (how to generate reports for different jurisdictions)
CREATE TABLE IF NOT EXISTS tax_report_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    formula_id UUID REFERENCES tax_formulas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50), -- 'monthly', 'quarterly', 'annual'
    
    -- What to include in the report
    included_metrics JSONB DEFAULT '{
        "total_revenue": true,
        "taxable_revenue": true,
        "days_available": false,
        "days_rented": false,
        "occupancy_rate": false,
        "platform_fee_breakdown": true,
        "tax_collected_by_platform": true,
        "owner_tax_liability": true
    }'::jsonb,
    
    -- How to group and display data
    grouping_options JSONB DEFAULT '{
        "group_by": "property",
        "secondary_group": "month",
        "include_platform_breakdown": true,
        "show_calculation_details": false
    }'::jsonb,
    
    -- Custom fields for specific jurisdictions
    custom_fields JSONB DEFAULT '[]'::jsonb,
    
    output_format VARCHAR(20) DEFAULT 'standard', -- 'standard', 'detailed', 'summary', 'custom'
    custom_template TEXT, -- For jurisdictions with specific format requirements
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced platform fee entries with API integration tracking
ALTER TABLE platform_fee_entries 
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS platform_collected_tax DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS effective_tax_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS api_sync_date TIMESTAMP WITH TIME ZONE;

-- Booking financial details for tax calculations
CREATE TABLE IF NOT EXISTS booking_financial_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Platform fees from API
    guest_service_fee DECIMAL(10, 2), -- What guest paid to platform
    host_service_fee DECIMAL(10, 2),  -- What host paid to platform
    
    -- Tax details
    platform_collected_tax DECIMAL(10, 2),
    platform_remitted_tax DECIMAL(10, 2),
    
    -- Additional fees that might be taxable
    credit_card_processing_fee DECIMAL(10, 2),
    channel_commission DECIMAL(10, 2),
    
    -- Metadata
    data_source VARCHAR(20) DEFAULT 'api', -- 'api', 'manual', 'hybrid'
    last_synced TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(booking_id)
);

-- Tax calculation audit log for compliance
CREATE TABLE IF NOT EXISTS tax_calculation_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id),
    booking_id UUID REFERENCES bookings(id),
    formula_id UUID REFERENCES tax_formulas(id),
    
    -- Calculation details
    calculation_date DATE NOT NULL,
    revenue_components JSONB NOT NULL, -- All revenue items included
    tax_calculations JSONB NOT NULL,   -- Step-by-step calculation
    final_amounts JSONB NOT NULL,      -- Final tax amounts
    
    -- For split bookings
    is_split_booking BOOLEAN DEFAULT false,
    split_details JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tax_formulas_tenant ON tax_formulas(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tax_formulas_jurisdiction ON tax_formulas(jurisdiction_type, jurisdiction_name);
CREATE INDEX IF NOT EXISTS idx_tax_report_configs_formula ON tax_report_configs(formula_id);
CREATE INDEX IF NOT EXISTS idx_booking_financial_booking ON booking_financial_details(booking_id);
CREATE INDEX IF NOT EXISTS idx_tax_audit_tenant_date ON tax_calculation_audit(tenant_id, calculation_date);
CREATE INDEX IF NOT EXISTS idx_tax_audit_booking ON tax_calculation_audit(booking_id);

-- Triggers for updated_at
CREATE TRIGGER update_tax_formulas_updated_at BEFORE UPDATE ON tax_formulas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_report_configs_updated_at BEFORE UPDATE ON tax_report_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_booking_financial_details_updated_at BEFORE UPDATE ON booking_financial_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
