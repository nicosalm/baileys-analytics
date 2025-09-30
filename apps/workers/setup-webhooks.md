# Setting Up OwnerRez Webhooks

The webhook events table is empty, which means webhooks haven't been configured in OwnerRez yet.

## Steps to Configure Webhooks:

### 1. Log into OwnerRez
Go to https://app.ownerrez.com and sign in

### 2. Navigate to API & Webhooks
- Go to **Settings** → **API** → **Webhooks**
- Or direct link: https://app.ownerrez.com/settings/api/webhooks

### 3. Create a New Webhook
Click **"Create Webhook"** and configure:

**Webhook URL:**
```
https://baileys-analytics-api-production.nicosalm.workers.dev/api/webhooks/ownerrez
```

**Authentication Type:** Basic Auth
- Username: `baileysanalytics`
- Password: `***REMOVED***`

**Events to Subscribe To:**
- ✅ Property Created
- ✅ Property Updated
- ✅ Property Deleted
- ✅ Booking Created
- ✅ Booking Updated
- ✅ Booking Canceled
- ✅ Guest Created
- ✅ Guest Updated
- ✅ Inquiry Created
- ✅ Quote Created

**Additional Settings:**
- Active: ✅ Yes
- Include Entity Data: ✅ Yes
- Include Categories: ✅ Yes (especially "charge" for booking charges)

### 4. Test the Webhook
After saving, click **"Test Webhook"** to send a test event.

You should see a successful response. Check the webhook_events table:
```sql
SELECT * FROM webhook_events 
WHERE tenant_id = '086e58b7-8ae5-4aa9-9cbe-ec3ba51e202b'
ORDER BY created_at DESC
LIMIT 5;
```

### 5. Verify Webhook is Working
Make a small change to a test booking in OwnerRez and verify it appears in the webhook_events table.

## Why Webhooks Are Important

Webhooks provide real-time updates when data changes in OwnerRez:
- New bookings appear immediately
- Cancellations are reflected instantly
- Guest information updates automatically
- No need for constant manual syncing

Without webhooks, you'll need to manually sync data using the recovery sync button.

## Troubleshooting

If webhooks aren't working:

1. **Check the webhook URL is accessible:**
   ```bash
   curl -X POST https://baileys-analytics-api-production.nicosalm.workers.dev/api/webhooks/ownerrez \
     -u "***REMOVED***" \
     -H "Content-Type: application/json" \
     -d '{"action":"webhook_test","user_id":347380287}'
   ```

2. **Check webhook events in the database:**
   ```sql
   SELECT COUNT(*) FROM webhook_events;
   ```

3. **Check sync status:**
   ```sql
   SELECT * FROM sync_status 
   WHERE sync_type LIKE '%webhook%' 
   ORDER BY last_sync DESC;
   ```

4. **Force a recovery sync if needed:**
   Use the Recovery Sync button in Settings → Integrations with the "Force Sync" option.

## Deployment Configuration

### Setting Up Webhook Authentication (For Developers)

The webhook endpoint requires Basic Authentication. The credentials must be set as Cloudflare Worker secrets:

1. **Set the webhook username:**
   ```bash
   echo 'baileysanalytics' | wrangler secret put OWNERREZ_WEBHOOK_USER --name baileys-analytics-api-production
   ```

2. **Set the webhook password:**
   ```bash
   printf '***REMOVED***' | wrangler secret put OWNERREZ_WEBHOOK_PASSWORD --name baileys-analytics-api-production
   ```

3. **Verify secrets are set:**
   ```bash
   wrangler secret list --name baileys-analytics-api-production
   ```

4. **Deploy the worker:**
   ```bash
   pnpm run deploy:production
   ```

**Important:** After adding or updating secrets, you must redeploy the worker for changes to take effect.

### Environment Variables Required

The following environment variables must be configured in production:
- `OWNERREZ_WEBHOOK_USER` - Webhook authentication username (set as secret)
- `OWNERREZ_WEBHOOK_PASSWORD` - Webhook authentication password (set as secret)
- `OWNERREZ_CLIENT_ID` - OwnerRez OAuth client ID
- `OWNERREZ_CLIENT_SECRET` - OwnerRez OAuth client secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key