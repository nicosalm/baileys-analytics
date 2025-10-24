-- Cleanup Duplicate Indexes
-- These indexes are redundant with more specific composite indexes

-- 1. booking_charges: Remove single-column index, keep composite index
-- Keep: idx_booking_charges_booking_type (booking_id, type)
-- Drop: idx_booking_charges_type (just type)
DROP INDEX IF EXISTS idx_booking_charges_type;

-- 2. bookings: Remove single-column index, keep composite index
-- Keep: idx_bookings_tenant_status (tenant_id, status)
-- Drop: idx_bookings_status (just status)
DROP INDEX IF EXISTS idx_bookings_status;

-- 3. properties: Remove single-column index, keep composite index
-- Keep: idx_properties_tenant_active (tenant_id, active)
-- Drop: idx_properties_active (just active)
DROP INDEX IF EXISTS idx_properties_active;

-- Verification query:
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE tablename IN ('booking_charges', 'bookings', 'properties')
--   AND indexname IN ('idx_booking_charges_type', 'idx_bookings_status', 'idx_properties_active')
-- ORDER BY tablename, indexname;
-- Should return 0 rows after running this migration
