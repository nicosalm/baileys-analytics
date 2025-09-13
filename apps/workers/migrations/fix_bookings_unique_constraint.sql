-- add missing columns and constraints for bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS ownerrez_booking_id INTEGER;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'bookings_tenant_ownerrez_unique'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_tenant_ownerrez_unique 
        UNIQUE (tenant_id, ownerrez_booking_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_ownerrez_id 
ON bookings(ownerrez_booking_id);
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS platform_reservation_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS children INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS infants INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS booked_utc TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS canceled_utc TIMESTAMP WITH TIME ZONE;