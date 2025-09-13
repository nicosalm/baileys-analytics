-- add unique constraint for properties table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'properties_tenant_ownerrez_unique'
    ) THEN
        ALTER TABLE properties 
        ADD CONSTRAINT properties_tenant_ownerrez_unique 
        UNIQUE (tenant_id, ownerrez_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_ownerrez_id 
ON properties(ownerrez_id);