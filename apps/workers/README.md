# Baileys Analytics - Workers

## Useful Scripts

### Get Auth Token
```bash
./get-token.sh
```
Retrieves an auth token for testing API endpoints locally.

### Verify Database
```sql
-- Run these queries in Supabase SQL editor to verify sync status
-- See verify-database.sql for complete queries
```

### Setup Webhooks
See `setup-webhooks.md` for detailed instructions on configuring OwnerRez webhooks.

## Development

```bash
# Start dev server
pnpm dev

# Build
pnpm build

# Deploy to Cloudflare
pnpm deploy
```

## API Endpoints

### Sync Endpoints
- `GET /api/sync/status` - Check sync status
- `POST /api/sync/properties` - Step 1: sync properties and tags
- `POST /api/sync/bookings` - Step 2: sync all bookings, charges, and blocks
- `POST /api/sync/guests` - Step 3: sync guests with contact info and tags
- `POST /api/sync/inquiries` - Step 4: sync inquiries (optional)
- `POST /api/sync/complete` - Mark initial sync as done
- `POST /api/sync/reset` - Reset sync status to allow re-sync

### Webhook Endpoint
- `POST /api/webhooks/ownerrez` - Receives real-time updates from OwnerRez

## Environment Variables

Required in `.dev.vars`:
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
DATABASE_URL=
OWNERREZ_CLIENT_ID=
OWNERREZ_CLIENT_SECRET=
OWNERREZ_WEBHOOK_USER=
OWNERREZ_WEBHOOK_PASSWORD=
FRONTEND_URL=
```