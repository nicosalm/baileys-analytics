-- migration: add platform fee tracking
-- adds host service fees to bookings and creates platform guest fees table

-- step 1: add host_service_fee to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS host_service_fee NUMERIC(10,2) DEFAULT 0;

-- step 2: create platform_guest_fees table for manual entry
CREATE TABLE IF NOT EXISTS platform_guest_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  year INT,
  month INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- step 3: create indexes
CREATE INDEX IF NOT EXISTS idx_platform_guest_fees_tenant
ON platform_guest_fees(tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_guest_fees_booking
ON platform_guest_fees(booking_id)
WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_guest_fees_month
ON platform_guest_fees(tenant_id, year, month);

CREATE INDEX IF NOT EXISTS idx_platform_guest_fees_platform
ON platform_guest_fees(tenant_id, platform);

-- step 4: add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_platform_guest_fees_tenant_period
ON platform_guest_fees(tenant_id, year, month, platform);

-- step 5: add check constraints
ALTER TABLE platform_guest_fees
ADD CONSTRAINT check_amount_positive
CHECK (amount >= 0);

ALTER TABLE platform_guest_fees
ADD CONSTRAINT check_month_valid
CHECK (month IS NULL OR (month >= 1 AND month <= 12));

ALTER TABLE platform_guest_fees
ADD CONSTRAINT check_year_reasonable
CHECK (year IS NULL OR (year >= 2020 AND year <= 2100));

-- step 6: add constraint to ensure either booking_id or year/month is set
ALTER TABLE platform_guest_fees
ADD CONSTRAINT check_booking_or_period
CHECK (
  (booking_id IS NOT NULL AND year IS NULL AND month IS NULL) OR
  (booking_id IS NULL AND year IS NOT NULL AND month IS NOT NULL)
);

-- step 7: create trigger for updated_at
CREATE OR REPLACE FUNCTION update_platform_guest_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_guest_fees_updated_at
BEFORE UPDATE ON platform_guest_fees
FOR EACH ROW
EXECUTE FUNCTION update_platform_guest_fees_updated_at();

-- verification query
SELECT
  COUNT(*) as total_bookings,
  COUNT(host_service_fee) as with_host_fee,
  SUM(host_service_fee) as total_host_fees
FROM bookings
WHERE status <> 'canceled';
