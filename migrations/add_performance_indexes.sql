-- Performance indexes for Baileys Analytics
-- These indexes optimize the most common query patterns

-- ============================================
-- BOOKINGS TABLE INDEXES
-- ============================================

-- Index for tenant + arrival date queries (most common pattern)
-- Used by: dashboard, overview, financial reports, metrics
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_arrival
ON bookings(tenant_id, arrival DESC);

-- Index for tenant + status filtering
-- Used by: filtering active vs canceled bookings
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status
ON bookings(tenant_id, status);

-- Index for property-specific queries with date range
-- Used by: property metrics, property detail views
CREATE INDEX IF NOT EXISTS idx_bookings_property_tenant_arrival
ON bookings(property_id, tenant_id, arrival DESC);

-- Index for property + arrival (without tenant_id for simpler queries)
-- Used by: per-property date range queries
CREATE INDEX IF NOT EXISTS idx_bookings_property_arrival
ON bookings(property_id, arrival DESC);

-- Index for property-specific status filtering
-- Used by: property metrics excluding canceled bookings
CREATE INDEX IF NOT EXISTS idx_bookings_property_status
ON bookings(property_id, status);

-- ============================================
-- PROPERTIES TABLE INDEXES
-- ============================================

-- Index for tenant + active status
-- Used by: getting active properties for dashboard
CREATE INDEX IF NOT EXISTS idx_properties_tenant_active
ON properties(tenant_id, active);

-- Index for tenant + name (for alphabetical listing)
-- Used by: property lists, dropdowns
CREATE INDEX IF NOT EXISTS idx_properties_tenant_name
ON properties(tenant_id, name);

-- ============================================
-- BOOKING_CHARGES TABLE INDEXES
-- ============================================

-- NOTE: idx_booking_charges_booking_type already exists (booking_id, type)
-- No additional indexes needed for booking_charges

-- ============================================
-- BOOKING_TAGS TABLE INDEXES (if table exists)
-- ============================================

-- Index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_booking_tags_tag
ON booking_tags(tag_id, booking_id);

-- Index for getting tags for a booking
CREATE INDEX IF NOT EXISTS idx_booking_tags_booking
ON booking_tags(booking_id, tag_id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- To verify indexes were created, run:
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('bookings', 'properties', 'booking_charges', 'booking_tags')
-- ORDER BY tablename, indexname;

-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('bookings', 'properties', 'booking_charges', 'booking_tags')
-- ORDER BY idx_scan DESC;
