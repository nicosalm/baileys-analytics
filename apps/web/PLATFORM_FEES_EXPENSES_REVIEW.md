# Platform Fees & Expenses Widgets — Status Review

Context: This document was written after implementing the Guest Listing Site Fees feature
(booking-level fee estimation, Direct Booking Opportunity panel on Guests dashboard, fee
breakdown in Guest Detail modal). It evaluates whether two pre-existing manual-entry
settings widgets are still needed.

---

## 1. Platform Fee Entries (`platform_fee_entries` table)

### What it is
A manual data-entry system. Users open Settings → Tax Management and enter, per property
per month, the fees that OTAs charged that month: `guest_service_fee`, `host_service_fee`,
`platform_tax_remitted`, and a flag for whether the platform remits tax directly. The UI
is `PlatformFeeCard` (in `TaxCenter.tsx`) and `PlatformFeeEntryModal`.

### What it drives
`financial.ts` reads `platform_fee_entries` in three places:
- `getPLData` — subtracts fees from gross to produce net revenue
- `getRevenueData` — same, for year-over-year comparison
- `getTaxData` — uses `platform_tax_remitted` to show tax remitted by platforms

### Why it was built
It was the only way to capture OTA guest/host fees before we had booking-level charge data.
OR's API doesn't expose the guest-facing OTA service fee (the "Guest Listing Site Fee" shown
in OR's UI), so this was a manual workaround.

### What we have now
- `booking_charges` — synced from OR, contains all host-side charges per booking including
  credit card fees (type `surcharge`, description contains "Credit Card Fee") and the host
  service fee (`host_service_fee` column on bookings, sourced from OR's `total_host_fees`)
- `guest_listing_site_fee` column on `bookings` — estimated OTA guest-side fee (Vrbo ~13%,
  Airbnb ~15% of `total_amount`). Will be replaced with OR's real value once Paul / OR
  exposes it via the v2 API (email sent).

### Verdict: **Redundant, but not yet safe to remove**

The manual entry is fully superseded by booking-level data for the guest fee side. However:

1. `financial.ts` still reads `platform_fee_entries` to compute net revenue and tax figures.
   If any data exists there, removing the widget without migrating the financial service
   would silently drop those values from P&L.
2. The `platform_tax_remitted` field still has no equivalent in booking-level data — OR
   doesn't expose per-booking platform tax remittance via the API.

**Recommended path:**
- Check whether any `platform_fee_entries` rows exist with non-zero values for the tenant.
  (`SELECT COUNT(*) FROM platform_fee_entries WHERE guest_service_fee > 0 OR host_service_fee > 0`)
- If empty (likely, given the widget requires manual effort): deprecate the widget, remove
  the `platform_fee_entries` reads from `financial.ts`, and replace with:
  - Guest fees → `SUM(guest_listing_site_fee)` from bookings in period
  - Host fees → `SUM(host_service_fee)` from bookings in period (already synced from OR)
  - Platform tax → still no automated source; either keep a simpler manual field or drop it
- If data exists: migrate it to booking-level fields before removing.

The `PlatformFeeCard`, `PlatformFeeEntryModal`, `usePlatformFees` hook, and
`schemas/platformFees.ts` can all be deleted once the financial service is migrated.

---

## 2. Operating Expenses (`operating_expenses` table)

### What it is
A manual data-entry system for property-level operating costs: maintenance, supplies,
utilities, mortgage, insurance, etc. Users enter expenses per property per month via
`ExpenseManagementPanel` and `OperatingExpenseEntryModal`.

### What it drives
`financial.ts` reads `operating_expenses` in `getPLData` to produce the expenses line
in the P&L view. Without it, the P&L has no cost side.

### Relationship to the new fee work
None. Operating expenses are overhead costs that have nothing to do with OTA service fees
or credit card processing fees. These are property operating costs, not booking fees.

### Verdict: **Keep as-is**

This widget is doing a job that booking-level data can't replace. OR has no concept of
property-level operating expenses. This is genuinely user-entered data and should stay.

---

## Summary

| Widget | Table | Status | Action |
|--------|-------|--------|--------|
| Platform Fee Entries | `platform_fee_entries` | Redundant — superseded by `booking_charges` + `guest_listing_site_fee` | Migrate `financial.ts` away from it, then delete widget |
| Operating Expenses | `operating_expenses` | Still needed — no automated source for this data | Keep |

---

## Files to delete when Platform Fee Entries is removed

- `apps/web/src/components/tax/PlatformFeeCard.tsx`
- `apps/web/src/components/modals/PlatformFeeEntryModal.tsx`
- `apps/web/src/schemas/platformFees.ts`
- `apps/web/src/hooks/use-api.ts` — remove `usePlatformFees` hook
- `apps/web/src/lib/api.ts` — remove platform fee API methods
- `apps/web/src/contexts/modal.tsx` — remove `platform-fee-entry` modal type
- `apps/web/src/components/ModalManager.tsx` — remove platform fee entry case
- `apps/workers/src/routes/financial.ts` — remove platform_fee_entries reads
- `apps/workers/src/routes/property-detail.ts` — check for platform fee references
- `apps/workers/src/routes/period-detail.ts` — check for platform fee references
- `apps/workers/src/routes/operating-expenses.ts` — this is for operating expenses, keep it
- `apps/workers/src/routes/account.ts` + `admin.ts` — check for platform_fee_entries references

The `platform_fee_entries` table itself can be dropped from Supabase after migration.
