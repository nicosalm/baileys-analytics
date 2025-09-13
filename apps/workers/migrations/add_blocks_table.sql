-- create blocks table for property availability blocks
CREATE TABLE IF NOT EXISTS blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL,
    ownerrez_block_id INTEGER UNIQUE,
    arrival DATE NOT NULL,
    departure DATE NOT NULL,
    type VARCHAR(50) DEFAULT 'block',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocks_tenant_id ON blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocks_property_id ON blocks(property_id);
CREATE INDEX IF NOT EXISTS idx_blocks_dates ON blocks(arrival, departure);
CREATE INDEX IF NOT EXISTS idx_blocks_ownerrez_id ON blocks(ownerrez_block_id);

-- add rls policies
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- policy for tenant access
CREATE POLICY "Tenants can view their own blocks" ON blocks
    FOR SELECT USING (tenant_id IN (
        SELECT id FROM tenants WHERE user_id = auth.uid()
    ));

-- policy for service role (webhooks/sync)
CREATE POLICY "Service role has full access to blocks" ON blocks
    FOR ALL USING (auth.role() = 'service_role');