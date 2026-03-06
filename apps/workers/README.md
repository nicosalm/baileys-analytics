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
- `POST /api/initial-sync/full` - Full historical sync (4 years back, 1 year forward)
- `POST /api/sync/recovery` - Recovery sync (last 7 days, requires X-Force-Sync header)
- `POST /api/sync/properties` - Sync only properties
- `POST /api/sync/guest-details` - Update guest contact information
- `GET /api/sync-status` - Check current sync status

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