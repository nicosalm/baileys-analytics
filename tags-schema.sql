-- Tags schema for Baileys Analytics

-- Tags table (normalized)
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ownerrez_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'property', 'booking', 'guest', 'payment', 'custom'
    color VARCHAR(7), -- hex color like #3B82F6
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, ownerrez_id)
);

-- Many-to-many relationships
CREATE TABLE IF NOT EXISTS property_tags (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (property_id, tag_id)
);

CREATE TABLE IF NOT EXISTS booking_tags (
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (booking_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_property_tags_property_id ON property_tags(property_id);
CREATE INDEX IF NOT EXISTS idx_property_tags_tag_id ON property_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_booking_tags_booking_id ON booking_tags(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_tags_tag_id ON booking_tags(tag_id);

-- Updated timestamp trigger for tags
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
