# Data Integrity Fixes

Verified issues with ACID compliance, idempotency, and data integrity.

**Migration:** `supabase/migrations/20260311_data_integrity_fixes.sql`
Run this against your Supabase project before deploying the worker changes.

## Priority 1 — Real risk of data loss/corruption

### 1. Delete-then-insert without transactions (config data)
- **Files:** `platform-fees.ts`, `expense-templates.ts`, `operating-expenses.ts`, `tax.ts`
- **Problem:** Delete succeeds, insert fails → data gone. No transaction wrapping.
- **Fix:** Table-specific Supabase RPCs (`replace_expense_templates`, `replace_operating_expenses`, `replace_platform_fees`, `replace_active_tax_config`) that delete+insert in a single transaction.
- [x] Done

### 2. Billing history duplicates on webhook retry
- **File:** `services/stripe.ts`
- **Problem:** Plain `.insert()` with no unique constraint check. Stripe retries create duplicate payment records.
- **Fix:** Added unique constraint on `stripe_invoice_id`, changed to `.upsert()` with `onConflict`.
- [x] Done

### 3. Usage metric lost updates (read-then-write race)
- **File:** `services/stripe.ts`
- **Problem:** Two concurrent calls both read count=5, both write count=6. Lost increment.
- **Fix:** `increment_usage_metric` RPC with `SET count = count + p_count` (atomic).
- [x] Done

### 4. Webhook tag partial insertion
- **File:** `routes/webhooks.ts` (property, booking, and guest tags)
- **Problem:** Deletes all tags, then inserts one-by-one in a loop. If any insert fails, partial tags remain.
- **Fix:** Extracted `replaceEntityTags` helper that resolves all tag IDs first, then does a single batch insert.
- [x] Done

### 5. Unchecked delete errors on platform fees
- **File:** `routes/platform-fees.ts`
- **Problem:** Delete result not checked before proceeding to insert on single-fee and booking-fee routes.
- **Fix:** Added error checks that return 500 before attempting insert.
- [x] Done

## Priority 2 — Low probability, manageable consequence

### 6. Stripe webhook double-processing (TOCTOU)
- **File:** `services/stripe.ts`
- **Problem:** Check-then-upsert allows two concurrent webhook deliveries to both pass the duplicate check.
- **Fix:** Changed to plain `INSERT` + catch unique constraint violation (23505) to skip duplicate events.
- [x] Done

### 7. Account deletion non-atomic
- **Files:** `routes/account.ts`, `routes/admin.ts`
- **Problem:** Sequential deletes across ~22-27 tables with `continue` on error. Partial deletion leaves orphaned data.
- **Fix:** `delete_tenant_data` RPC that deletes all tables in FK-safe order within a single transaction. Both account and admin routes now use it.
- [x] Done

### 8. Webhook events marked processed despite silent sub-step failures
- **File:** `routes/webhooks.ts`
- **Problem:** If tag insertion silently fails (returns error without throwing), event is still marked processed. No retry possible.
- **Fix:** Wrapped handler dispatch in try/catch, only marks `processed: true` on success. Logs `processing_error` on failure.
- [x] Done
