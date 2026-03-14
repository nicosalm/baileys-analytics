# TODO — Jerry's Feedback (tester: jerry@baileysanalytics.com)

Items from Jerry's testing session, analyzed against OwnerRez API data, Supabase DB, and codebase.
Priority: P0 = data accuracy bug, P1 = important feature, P2 = nice-to-have polish.

## Completed

### Phase 1 — Platform normalization (S4 + #13) ✅
- Extracted `normalizePlatform()` to shared `apps/workers/src/utils/platform.ts`
- Added patterns: `null`/`'Unassigned'` → `'Direct'`, `TripAdvisor`
- Applied in all 4 services (`guests`, `financial`, `properties`, `overview`) and 4 routes (`guests`, `period-detail`, `property-detail`, `tax`)
- Removed unused frontend `normalizePlatformName` (backend now normalizes before sending)
- Removed dead "unassigned bookings" warning in OverviewDashboard
- Sync paths intentionally untouched (raw OwnerRez values preserved in DB, normalized at read time)

### Phase 2 — Sync `is_taxable` + fix tax rate (S1 + #3) ✅
- Added `is_taxable: charge.is_taxable ?? false` to all 4 sync charge upserts (`sync.ts` x2, `initial-sync-chunked.ts`, `webhooks.ts`)
- Added `is_taxable` to `booking_charges()` selects in `financial.ts` (shared batch query, PLData standalone, getTaxData standalone)
- Fixed tax effective rate: uses taxable base (`is_taxable = true` charges) as denominator instead of `total_amount`
- `hasTaxableData` flag computed once upfront; graceful fallback to `total_amount` if `is_taxable` not yet synced
- Consistent denominator across summary, per-property, and per-period (buildMonthlyTaxData) rates
- Single-pass charge iteration for efficiency
- No migration needed (`is_taxable` column already exists). Requires re-sync after deploy to populate values.

### Phase 3 — Fix net revenue formula (#5) ✅
- `getPLData()`: `netRevenue = grossRevenue - totalHostFees - totalTaxes` (removed `totalGuestFees` from subtraction)
- `getRevenueData()`: same fix — `net = gross - taxes - hostFees` (was including `guest_listing_site_fee`)
- `getRevenueData()` last-year comparison: same fix
- `totalPlatformFees` (host+guest) kept in API response as informational metric
- PLView: `totalCosts` now uses `hostFees` only (not `platformFees`); comparison period costs likewise
- PLView: monthly trend fee proportioning uses `hostFees` not `platformFees`
- PLView: labels updated — "Host Commission" / "Host Fees & Expenses", tooltip clarifies guest fees are billed separately
- PLView: info banner updated to reflect new flow
- RevenueFlowSankey: deduction node and legend both say "Host Fees" (was mismatched "Platform Fees" in legend)
- `guestFees` still passed to GuestSpendChart (correct — that chart shows what the guest pays, not owner costs)
- `getOverviewData()`: `platformFees` now only sums `host_service_fee` (was including `guest_listing_site_fee`)
- `getPropertyProfitability()` in properties.ts: `fees` now only sums `host_service_fee`
- `routes/financial.ts`: `expenses` and `netIncome` now use host fees only (current + comparison period)
- `routes/property-detail.ts`: `combinedPlatformFees` now uses host fees only; removed dead `totalGuestPlatformFees` variable
- `routes/period-detail.ts`: same fix; removed dead `totalGuestFees` variable
- OverviewDashboard: sub-label updated to "After host fees" (was "After fees (est.)")
- Recovery sync in `sync.ts` now includes `host_service_fee`, `guest_listing_site_fee`, `ownerrez_guest_id` (was missing, would have zeroed fee data on recovery)

### Phase 4 — Surcharge categorization (#2 + #8 + #10 + #4) ✅
- Added `normalizeSurchargeCategory()` in `services/financial.ts` — keyword matching with word-boundary regexes (`\btax\b`, `\bpet\b`) to avoid false positives (e.g. "carpet" → pet, "taxi" → tax)
- Extended `ChargeComposition` interface: `cleaning`, `linens`, `petFees`, `creditCardFees`, `otherSurcharges` (removed `other`)
- Rewrote charge composition loop: surcharges routed through normalizer, single call per charge, zero-amount security deposits filtered
- Surcharges with "tax" in description (e.g. "DCTZ Tax remitted by Door County Stay" sent as `type: "surcharge"`) correctly routed to taxes bucket with `displayType = 'tax'`
- `details[]` aggregated by normalized category (~5-8 rows instead of 30+ raw variants)
- GuestSpendChart: new segments (Base Rent, Taxes, Cleaning, Linens, Pet Fees, CC Fees, Booking Fees, Guest Platform Fee, Misc, Discounts) with distinct colors
- PLView: summary cards expanded to 7 (Taxes, Cleaning, Linens, Pet Fees, CC Fees, Discounts, Other Surcharges) — zero-value cards hidden
- PLView: detail row dot colors mapped to new category types
- "Repeat Customer" platform value now normalized to "Direct" in `utils/platform.ts`

---

## P0 — Data Accuracy Bugs

### 1. Tax count mismatch: 63 DCTZ vs 64 WI charges
> "Financials - booking charge composition - 63 DCTZ 64 WI - they should be the same"

**Root cause confirmed via OwnerRez API**: The source data genuinely has 63 DCTZ charges and 64 WI charges across 2025 bookings (tax_id 4293 and 4294). One booking has a WI tax but no corresponding DCTZ — a data entry gap in OwnerRez, not a bug in our code.

**Action**: No code fix needed. Our numbers accurately reflect the source. Consider adding a subtle "data from OwnerRez" footnote to the charge composition section so Jerry knows mismatches originate upstream.

---

### ~~2. Pet charges: $1,560 in app vs $3,899 in QuickBooks~~ → Fixed in Phase 4

---

### ~~3. Taxes showing < 13.5% effective rate~~ → Fixed in Phase 2

---

### ~~4. Guest spend breakdown fees are wrong~~ → Fixed in Phase 4 (automatic once #2/#8 done)

---

### ~~5. Platform fees should be separated from revenue~~ → Fixed in Phase 3

---

## P1 — Important Features

### 6. Guest list: add Cancellations and Inquiries tabs
> "On guest list can you add a cancellations tab" / "A guest Ruth Blackburn cancelled this week, I want her details to call her"

**Root cause confirmed**: `getGuestsData()` in `services/guests.ts:102` filters `.neq('status', 'canceled')`. Ruth Blackburn is in our DB (`status: canceled`, arrival: 2026-06-12, Airbnb, CBC, total_amount: $0) but excluded from all guest views. There are 20+ cancelled bookings in the DB (19 from OwnerRez + demo data).

**Inquiry status**: OwnerRez has a `GET /v2/inquiries` endpoint. We do NOT currently sync inquiries — there is no `inquiries` table or sync job. This would need a new table + sync.

**Fix**:
- **Backend** (`services/guests.ts`): Add `getCancelledGuests()` function that queries `status = 'canceled'` and returns guest details (name, email, phone, property, arrival/departure, platform, total_amount). Keep it simple — just a list of cancelled bookings with guest info.
- **Backend**: For inquiries, add an `inquiries` table and sync from `GET /v2/inquiries` in the sync job. Include `guest_id`, `property_id`, `arrival`, `departure`, `listing_site`, `comments`, `created_utc`.
- **Frontend** (`GuestsDashboard.tsx`): Add tab navigation (Active | Cancelled | Inquiries) above the guest list. Active = current behavior. Cancelled = new endpoint. Inquiries = new endpoint.
- **Guest search**: Ensure search covers all statuses. Currently search is client-side filtering of the already-fetched (active-only) list.

---

### ~~7. SmartPeriodSelector: add "All Time" option~~ → Done
> Added "All Time" to Quick Periods. Backend endpoint `GET /bookings/earliest-date` queries `min(arrival)` dynamically. Option only appears once earliest date is loaded.

---

### ~~8. Guest spend breakdown: add linen, pet, CC fee categories~~ → Fixed in Phase 4

---

### 9. Guest spend breakdown: Direct vs OTA toggle
> "Could you put a toggle in that box — direct and OTA? I do not like to have platform fees diluted"

**Fix**:
- **Backend**: Split charge composition by booking platform. Already have `platform` on each booking. Compute separate `ChargeComposition` objects for direct vs OTA bookings.
- **Frontend** (`GuestSpendChart.tsx`): Add a segmented control (All | Direct | OTA). When "OTA" selected, platform fees become more prominent in the breakdown. When "Direct", they disappear entirely.
- Jerry's point is that blending direct and OTA dilutes the visibility of platform fees. In OTA-only view, fees as a percentage of total spend become much more striking.

---

### ~~10. Booking charge composition: aggregate and clean up~~ → Fixed in Phase 4

---

### 11. Charge composition CSV export
> "Is there a way you can give me a spreadsheet of the booking charge composition?"

**Fix**:
- Add a CSV download button to the charge composition section (follow the existing pattern from `/tax/export` endpoint in `routes/tax.ts`)
- Columns: Guest Name, Property, Arrival, Departure, Charge Type, Description, Amount, Is Taxable
- Include one row per charge per booking (not aggregated — Jerry wants to reconcile against QuickBooks)
- Add endpoint: `GET /financial/charges-export?from=...&to=...`

---

## P2 — Polish & Minor Fixes

### ~~12. Occupancy calendar: darken colors~~ → Done
> Darkened light theme occupancy heatmap colors by ~0.06-0.10 lightness. Borders darkened proportionally. Dark theme unchanged.

---

### ~~13. Unassigned booking in direct booking opportunities~~ → Fixed in Phase 1

---

### 14. Guest tags: property-code tags show nothing for current season
> "When I click guest tags — all home cmc, cec, cdc, cbc, cnc — for current season nothing populates"

**Interpreting Jerry's intent**: "When I click guest tags" most likely means he navigates to the Guest Tags section/chart on the Guests dashboard and selects the property-code tags (CMC, CEC, CDC, CBC, CNC — "all homes") using the FilterBar tag filter. For the current (2026) season, the dashboard shows empty because no 2026 bookings have these tags.

**Two underlying issues**:

**(a) Property-code tags have no 2026 bookings**: Tags CBC, CDC, CEC, CMC, CNC exist in the `tags` table but OwnerRez has NOT tagged any 2026 bookings with them (confirmed: 0 tags on all 24 active 2026 bookings in the OR API). For 2025, only 1 booking has "CEC". These are operational tags Jerry applies manually in OwnerRez; he hasn't tagged 2026 bookings yet. This is the primary reason for the empty state.

**(b) Tag chart is display-only**: The "Guest Tags" bar chart in `GuestsDashboard.tsx` has no onClick handlers — tag rows are plain `<div>` elements. If Jerry is also trying to click individual tags in the chart to filter, that does nothing.

**Fix**:
- **(a)** Since these property-code tags functionally duplicate the Property filter, the best approach is to auto-populate them during sync: when syncing a booking for property CBC, automatically add the "CBC" tag to that booking's `booking_tags`. This ensures the property-code tags always have data. Alternatively, show an empty-state message: "No bookings have this tag for the selected period — try the Property filter instead."
- **(b)** Make tag chart rows clickable → apply that tag to the FilterBar tag filter (add the tag ID to `selectedTags` in dashboard context). This gives Jerry the interactive filter-by-tag UX he likely expects.

---

### ~~15. Tax "needs setup" — what to do?~~ → Done
> "Needs Setup" badge is now a clickable button that navigates to `/settings?tab=expenses`. Tooltip: "Click to configure tax jurisdictions".

---

### 16. CMC taxes → total revenue click behavior
> "When I click cmc taxes and then total revenue what should happen?"

**Context**: `TaxCenter.tsx` receives `onPropertyClick` and `onPeriodClick` as optional props. The property name is a `Button variant="link"` that calls `onPropertyClick?.(row.propertyId)`. There is no clickable "total revenue" element — the metric cards are not interactive.

**Fix**: Define click-through behavior:
- Click property name in tax table → open `PropertyDetailModal` (already exists) with focus on the tax/financial section
- Click the "Total Tax Due" metric → scroll to or expand the trend chart
- "Total Revenue" is not a separate clickable element in TaxCenter — Jerry may be referring to the P&L view's gross revenue metric. If he wants to cross-reference tax with revenue, consider adding a "View in P&L" link.

---

## Deferred / Jerry's Side

### 17. Charge cleanup in OwnerRez
> "I have to clean up charges, linens etc"

Jerry's action item — inconsistent charge naming in OwnerRez (e.g., "Linen Fee", "CNC Linen Fee", "CEC Bed Linens Fee", "Bed linens fee" all mean the same thing). Our normalization (item #10) will handle this on the display side, but cleaner source data = better analytics long-term.

---

## Sync Gaps Found During Investigation

These are not Jerry's issues but were discovered during the analysis:

### ~~S1. `is_taxable` not synced from OwnerRez~~ → Fixed in Phase 2
### ~~S2. `surcharge_other` type not handled~~ → Fixed in Phase 4 (routed through `normalizeSurchargeCategory`)
### S3. `guest_listing_site_fee` is estimated, not from OwnerRez
Stored at sync time by `estimateGuestListingSiteFee()` in `constants.ts:62`. Uses fixed percentages (Airbnb 14.2%, Vrbo 8%, others 0%). This is a rough estimate. Jerry should understand this is approximate — consider labeling it more clearly as "(est.)" everywhere it appears.
### ~~S4. Platform normalization not shared across services~~ → Fixed in Phase 1

---

## Data Reference (from OwnerRez API, 2025 season, 74 active bookings)

| Metric | Amount |
|---|---|
| Total revenue (sum of total_amount) | $193,809.28 |
| Tax — DCTZ (63 charges, tax_id 4294) | $13,442.17 |
| Tax — WI (64 charges, tax_ids 4293+4294) | $9,343.19 |
| Total tax | $22,785.36 |
| Effective rate on total_amount | 11.76% |
| Effective rate on taxable charges | 13.39% |
| Pet fees | $4,370.66 |
| Linen fees | $11,840.44 |
| Cleaning fees | $18,741.60 |
| CC fees | $1,228.73 |
| Security deposit (withheld) | $500.00 |

**Cancelled bookings**: 19 in OwnerRez (2025-2026), including Ruth Blackburn (2026-06-12, Airbnb, CBC).

**Tags on 2026 bookings**: 0 (none applied in OwnerRez yet). 2025 bookings have ~49/50 tagged (Cleared, Linens, Legal signed, Paid most common).

**Platform distribution in DB** (500 active bookings sampled): Direct (168), Airbnb (128), VRBO (85), Booking.com (34), Vrbo (20), DoorCountyStay.com (17), Unassigned (16), Door County Stay Website (12), TripAdvisor (10), Repeat Customer (9), My Website (1). Normalizer misses: DoorCountyStay.com, Unassigned, TripAdvisor, Repeat Customer.

**OwnerRez API auth** (for future reference): `martina@doorcountystay.com` + `***REMOVED***` (basic auth). Properties: CEC (233861), CNC (233860), CDC (233859), CBC (233858), CMC (233857).

---

## Implementation Notes for Future Sessions

### Suggested order (remaining items)
1. **#6**: Cancelled guests + inquiries — larger feature, can be done independently.
2. **#9**: Direct/OTA toggle — Phase 4 provides the charge data, needs platform split in composition.
3. **#11**: CSV export — independent, follow `/tax/export` pattern.
4. **#14**: Guest tags — mostly a data/UX issue, lower priority.
5. **#16**: Tax click-through UX — small, independent.

### Key gotchas
- **Shared data path**: `getFinancialBatchData()` fetches bookings ONCE and passes them via `shared`. Shared query includes `booking_charges(amount, type, description, is_taxable)`.
- **Charge composition is in PLData only**: Built inside `getPLData()`. For Direct/OTA toggle (#9), split the composition loop by platform.
- **`estimateGuestListingSiteFee` is called at sync time**: Changing the estimation logic won't retroactively update existing bookings. A re-sync is needed after any changes.
- **Surcharge categorization**: `normalizeSurchargeCategory()` uses word-boundary regexes. OwnerRez sometimes sends taxes as `type: "surcharge"` — the normalizer catches these via `\btax\b` in description and routes to the taxes bucket.
- **The `type` field from OwnerRez**: Observed values are `rent`, `surcharge`, `surcharge_other`, `tax`. No `fee` type in practice — that branch is kept for forward compatibility.

### How to verify fixes
- **Tax rate (#3)**: After fix, effective rate should show ~13.4% (not 11.8%) for 2025 full year
- **Pet charges (#2)**: Aggregated "Pet Fees" row should show ~$4,370 for 2025 full year
- **Net revenue (#5)**: Will increase after removing guest fee subtraction (currently over-deducted)
- **Platform breakdown (#13/S4)**: Should show "Direct" (not "Unassigned"), and "VRBO"/"Vrbo" should merge
- **Cancelled guests (#6)**: Ruth Blackburn should appear in Cancelled tab for 2026 season
