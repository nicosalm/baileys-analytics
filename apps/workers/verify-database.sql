-- SQL queries to verify the sync is working correctly

-- 1. check if properties table has correct schema
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'properties'
ORDER BY ordinal_position;

-- 2. check if bookings have valid property_ids
SELECT 
    COUNT(*) as total_bookings,
    COUNT(DISTINCT b.property_id) as unique_properties,
    COUNT(CASE WHEN p.id IS NULL THEN 1 END) as orphaned_bookings,
    COUNT(CASE WHEN p.id IS NOT NULL THEN 1 END) as valid_bookings
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
WHERE b.tenant_id = (SELECT id FROM tenants LIMIT 1);

-- 3. check sample bookings with property names
SELECT 
    b.id,
    b.guest_name,
    b.total_amount,
    b.arrival,
    b.property_id,
    p.name as property_name,
    p.ownerrez_id
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
WHERE b.tenant_id = (SELECT id FROM tenants LIMIT 1)
ORDER BY b.arrival DESC
LIMIT 10;

-- 4. check revenue totals
SELECT 
    COUNT(*) as total_bookings,
    COUNT(DISTINCT guest_name) as unique_guests,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as avg_booking_value,
    MIN(arrival) as earliest_booking,
    MAX(arrival) as latest_booking
FROM bookings
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
    AND status != 'canceled';

-- 5. check sync status
SELECT 
    sync_type,
    last_sync,
    status,
    records_synced,
    error_message
FROM sync_status
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
ORDER BY last_sync DESC
LIMIT 10;

-- 6. check webhook events
SELECT 
    COUNT(*) as total_events,
    COUNT(CASE WHEN processed = true THEN 1 END) as processed,
    COUNT(CASE WHEN processed = false THEN 1 END) as pending,
    MAX(created_at) as last_event,
    MIN(created_at) as first_event
FROM webhook_events
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1);

-- 7. identify and fix orphaned bookings (bookings with invalid property_ids)
-- WARNING: only run this if you have orphaned bookings
/*
-- first, see which bookings are orphaned
SELECT 
    b.id,
    b.ownerrez_booking_id,
    b.property_id as invalid_property_id,
    b.guest_name
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
WHERE p.id IS NULL
    AND b.tenant_id = (SELECT id FROM tenants LIMIT 1)
LIMIT 10;

-- to delete orphaned bookings (be careful!)
DELETE FROM bookings 
WHERE property_id NOT IN (
    SELECT id FROM properties 
    WHERE tenant_id = bookings.tenant_id
);
*/