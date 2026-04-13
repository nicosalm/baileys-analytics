-- compound index on bookings to support the dashboard's paginated queries.
-- every dashboard service filters on (tenant_id, status, arrival, departure).
-- without this, offset-based pagination does sequential scans on large tenants.
--
-- if applying to a live database with heavy writes, consider running manually:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_tenant_status_arrival_departure
--   ON bookings(tenant_id, status, arrival, departure);

create index if not exists idx_bookings_tenant_status_arrival_departure
  on bookings(tenant_id, status, arrival, departure);
