-- create guest_tags junction table for many-to-many relationship between guests and tags
CREATE TABLE IF NOT EXISTS guest_tags (
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (guest_id, tag_id)
);

-- create indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_tags_guest_id ON guest_tags(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_tags_tag_id ON guest_tags(tag_id);

-- enable row level security
ALTER TABLE guest_tags ENABLE ROW LEVEL SECURITY;

-- create rls policies (assuming tenant isolation through guests table)
CREATE POLICY "Users can view guest tags for their tenant" ON guest_tags
    FOR SELECT
    USING (
        guest_id IN (
            SELECT id FROM guests 
            WHERE tenant_id IN (
                SELECT id FROM tenants 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role can manage all guest tags" ON guest_tags
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');