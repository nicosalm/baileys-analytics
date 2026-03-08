# Performance Optimization Plan

Target: 100-300 tenants, some with 20+ properties and thousands of bookings.

---

## Current State

### Query counts per dashboard-batch (cache miss)

| View | Current Period | + Comparison | Total Queries |
|------|---------------|--------------|---------------|
| Overview | 13 | +13 | 26 |
| Financial | 12-14 | +12-14 | 24-28 |
| Properties | 11-16 | +4 | 15-20 |
| Occupancy | 8-11 | +6-9 | 14-20 |
| Guests | 8-10 | +8-10 | 16-20 |

At scale (20 properties, 2000+ bookings per period), each Supabase round-trip is ~50-200ms.
A financial view with comparison can take **2-4 seconds** on cache miss.

### Database indexes

Done. Added 3 missing indexes (properties, seasons, tax configs), dropped 8 redundant
indexes to reduce write amplification. The real problem is query count.

---

## Phase 2: Query Consolidation

The same data is fetched repeatedly within a single dashboard-batch request.

### 2a. Shared booking fetch

Today, every service independently queries bookings. For the `properties` view,
`getPropertyMetrics`, `getPropertyProfitability`, and `getPropertyPlatformMix` each fetch
the same bookings table with nearly identical filters.

**Change**: Fetch bookings once at the dashboard-batch handler level, pass the result into services.

```
// before (properties view): 3 independent booking queries
const [metrics, profitability, platformMix] = await Promise.all([
  getPropertyMetrics(supabase, ...),      // fetches bookings
  getPropertyProfitability(supabase, ...), // fetches bookings again
  getPropertyPlatformMix(supabase, ...),  // fetches bookings again
]);

// after: 1 shared fetch
const bookings = await fetchBookings(supabase, tenantId, from, to, tagIds, filterPropertyIds);
const [metrics, profitability, platformMix] = await Promise.all([
  getPropertyMetrics(bookings, properties, ...),
  getPropertyProfitability(bookings, properties, ...),
  getPropertyPlatformMix(bookings, properties, ...),
]);
```

Same pattern applies to:
- **Financial view**: getPLData, getRevenueData, getCashflowData, getTaxData all fetch bookings
- **Overview**: fetchBookings, then getAlerts/getRecentActivity/getUpcomingBookings each re-query
- **Occupancy**: fetchOverallOccupancy, fetchPropertyOccupancy, fetchMonthlyOccupancy each query bookings + properties independently

**Estimated savings**: 8-15 eliminated queries per view.

### 2b. Shared properties fetch

Properties are static per tenant (change only on sync). Every service queries them independently.

**Change**: Fetch once, pass to all services. Even simpler — properties can be cached
in a short-lived in-memory map per request.

### 2c. Single tag pre-filter

When tag filtering is active, every service independently queries `booking_tags` to get
matching booking IDs. This is the same query repeated 3-6 times.

**Change**: Resolve tag → booking IDs once at the handler level.

```
let bookingIdFilter: string[] | null = null;
if (tagIds.length > 0) {
  const { data } = await supabase
    .from('booking_tags')
    .select('booking_id')
    .in('tag_id', tagIds);
  bookingIdFilter = data?.map(t => t.booking_id) ?? [];
}
// pass bookingIdFilter to all services
```

**Estimated savings**: 3-6 eliminated queries per tag-filtered request.

### 2d. Consolidate overview alerts

`getAlerts()` makes 5 separate count/select queries:
1. upcoming arrivals count
2. 30-day bookings select
3. property count
4. total bookings count
5. canceled bookings count

These can collapse to 2 queries:
- One bookings query with status grouping (returns total + canceled in one shot)
- One combined upcoming query (already have bookings from shared fetch)

### 2e. Consolidate upcoming/cashflow queries

Both `getPLData` and `getCashflowData` independently fetch upcoming bookings for
the next30/60/90 day calculations. These can share a single query.

### Query count after Phase 2

| View | Before | After (estimated) |
|------|--------|-------------------|
| Overview | 26 | 8-10 |
| Financial | 24-28 | 6-8 |
| Properties | 15-20 | 5-7 |
| Occupancy | 14-20 | 4-6 |
| Guests | 16-20 | 6-8 |

---

## ~~Phase 3: SQL-Side Aggregation~~

~~Move computation from JS to Postgres, eliminating the date-expansion loops entirely.~~

### ~~3a. Occupancy via SQL~~

Done — three Postgres RPCs replace all JS date-expansion loops:
- `get_overall_occupancy`: count distinct (property_id, date) via generate_series
- `get_property_occupancy`: per-property booked nights + revenue
- `get_periodic_occupancy`: bucketed by daily/weekly/monthly granularity

All three run in parallel from `getOccupancyData`. JS only computes period available
nights (pure date math, no data). Weekly granularity uses sunday-start to match JS.

Migration: `supabase/migrations/20260308_occupancy_rpcs.sql`

### 3b. Financial trend bucketing via SQL

Skipped — `buildTrendData`, `buildMonthlyRevenue`, `buildMonthlyTaxData` already
iterate bookings in a single pass with Maps. Data is fetched for other purposes anyway.
Moving to SQL doesn't save queries or reduce data transfer.

### 3c. Tax aggregation via SQL

Skipped — same rationale as 3b. Single-pass Map reduce over already-fetched bookings.

### ~~3d. Guest deduplication via SQL~~

Done — `get_repeat_guest_count` RPC replaces the full historical bookings fetch in
`overview.ts`. Uses `EXISTS` subquery instead of transferring thousands of rows to JS.
Uses overlapping semantics (`arrival <= to AND departure >= from`) to match the
`fetchBookings` query that builds the `uniqueGuests` set.

---

## Phase 4: Caching Improvements

### 4a. Tiered cache TTLs

Currently everything uses 30-min TTL. Static data should live longer:

| Data | Current TTL | Proposed TTL |
|------|-------------|-------------|
| Properties list | 30 min | 24 hours (invalidate on sync) |
| Seasons config | 30 min | 24 hours (invalidate on save) |
| Tax configs | 30 min | 24 hours (invalidate on save) |
| Dashboard views | 30 min | 30 min (keep as-is) |
| Expense templates | 30 min | 24 hours (invalidate on save) |

### 4b. Per-view cache invalidation

Currently, sync invalidates ALL cached views for a user. Most syncs only affect
booking data, so financial/occupancy/overview caches need invalidation but
seasons/tax-config caches don't.

**Change**: Tag cache entries by data dependency and only invalidate affected views.

### 4c. Shared sub-query cache within a request

For a single dashboard-batch call, properties and tag-filtered booking IDs should be
computed once and shared across all service calls. This isn't KV caching — it's just
passing data through function arguments instead of re-querying.

(This overlaps with Phase 2 but is worth calling out as a caching concept.)

### 4d. Stale-while-revalidate

Instead of blocking on cache miss, serve stale data immediately and revalidate in background.
Cloudflare Workers KV supports metadata — store `lastUpdated` timestamp and serve stale
data up to 2x TTL while triggering background refresh.

---

## ~~Phase 5: JS Algorithmic Cleanup~~

~~Low-effort fixes for code that remains in JS after SQL migration.~~

### ~~5a. Replace `.filter()` in loops with pre-built Maps~~

Done in Phase 2 refactor — all property loops in occupancy, properties, and overview
now use pre-built Maps.

### ~~5b. Single-pass next30/60/90~~

Done — `financial.ts` getPLData and getCashflowData both use single-pass accumulation.

### 5c. Use epoch-day integers instead of Date objects in inner loops

Skipped — string-based date keys are readable and the perf difference is negligible
at this scale (5 properties, <2000 bookings). Revisit only if Phase 3 SQL migration
is skipped and tenant scale exceeds 20+ properties.

### ~~5d. overview.ts `buildOccupancyChartData` daily mode~~

Done — daily path inverted to O(B+D) via epoch-day grid, monthly path uses
single-pass booking accumulation into month buckets.

---

## Priority Order

| Phase | Effort | Impact | Risk |
|-------|--------|--------|------|
| ~~1. Index cleanup~~ | ~~Low~~ | ~~Low-Medium~~ | **Done** |
| ~~2. Query consolidation~~ | ~~Medium~~ | ~~**High**~~ | **Done** |
| ~~5. JS algorithmic cleanup~~ | ~~Low~~ | ~~Low-Medium~~ | **Done** (5c skipped — negligible at scale) |
| ~~3. SQL-side aggregation~~ | ~~Medium-High~~ | ~~**High**~~ | **Done** (3b/3c skipped — already single-pass) |
| 4. Caching improvements | Medium | Medium | Low |

Phases 1, 2, 3, 5 done. Overview and Guests query consolidation skipped — different
shapes/filters, marginal payoff. Financial trend bucketing (3b) and tax aggregation (3c)
skipped — already efficient single-pass JS with data fetched for other purposes.

Next up: Phase 4 (caching improvements).

---

## What NOT to do

- **Rust/WASM**: Not justified at this scale. The bottleneck is I/O (query count), not CPU.
  Even at 20 properties / 12,000 bookings, JS computation is <100ms after algorithmic fixes.
  WASM saves <10ms on top of that.

- **Microservice split**: The monolithic worker is fine. Splitting services adds network hops
  and deployment complexity without solving the actual problem (too many queries).

- **GraphQL / query batching layer**: Adds complexity. The real fix is fetching data once
  and passing it through, not adding an abstraction layer on top of redundant fetches.

- **Read replicas**: Supabase free/pro tier doesn't support them, and the problem is query
  count, not database load. Indexes + consolidation solve this without infrastructure changes.
