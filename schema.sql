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
    sync_type VARCHAR(50) NOT NULL, -- 'initial', 'scheduled', 'manual'
    status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
    total_items INTEGER,
    processed_items INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_properties_tenant_id ON properties(tenant_id);
CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_property_id ON bookings(property_id);
CREATE INDEX idx_bookings_arrival_departure ON bookings(tenant_id, arrival, departure);
CREATE INDEX idx_booking_charges_booking_id ON booking_charges(booking_id);
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

CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_progress_updated_at BEFORE UPDATE ON sync_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
