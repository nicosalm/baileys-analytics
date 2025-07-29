# Baileys Analytics - Technical Documentation

## Project Overview

Multi-tenant SaaS platform for vacation rental analytics and automated tax reporting, integrating with OwnerRez property management system.

## Architecture

### Tech Stack
- **Monorepo**: pnpm workspaces with TypeScript
- **Backend**: Azure Functions v4 (Node.js 22)
- **Database**: PostgreSQL 15 (multi-tenant with tenant_id isolation)
- **Authentication**: OwnerRez OAuth 2.0 (PAT for development)
- **Frontend**: React with Chart.js (not yet implemented)

### Design Patterns
- Discriminated unions for state management
- Functional programming with immutable data transformations
- Result types for explicit error handling
- Small, composable functions
- No unnecessary comments or emojis

## Project Structure

```
baileys-analytics-platform/
├── apps/
│   └── functions/              # Azure Functions backend
│       └── src/
│           ├── services/       # Database connection
│           └── *.ts            # Function endpoints
├── packages/
│   ├── shared-types/           # TypeScript interfaces
│   ├── constants/              # API endpoints, enums
│   └── utils/                  # Shared utilities
├── schema.sql                  # Main database schema
├── oauth-schema.sql            # OAuth tables
└── setup.sh                    # Initial setup script
```

## Database Schema

### Multi-tenant Architecture
Every table includes `tenant_id` for data isolation.

### Tables
- **tenants**: OwnerRez accounts (email, company_name, ownerrez_user_id)
- **properties**: Synced from OwnerRez (name, address, coordinates, etc.)
- **bookings**: Reservations with guest info and amounts
- **booking_charges**: Line items (rent, tax, fees) for each booking
- **tax_configs**: User-defined tax rates (not yet used)
- **oauth_tokens**: Access/refresh tokens per tenant
- **oauth_states**: Temporary OAuth flow state

### Key Relationships
```
tenants (1) --> (N) properties
properties (1) --> (N) bookings
bookings (1) --> (N) booking_charges
tenants (1) --> (1) oauth_tokens
```

## API Endpoints

### Authentication
- `GET /api/oauth/initiate?email={email}` - Start OAuth flow
- `GET /api/oauth/callback?code={code}&state={state}` - OAuth callback

### Data Sync
- `POST /api/sync-properties` - Sync all properties from OwnerRez
- `POST /api/sync-bookings?from={date}&to={date}` - Sync bookings
- `POST /api/manual-sync` - Trigger full sync manually
- Timer: `auto-sync` - Runs every 12 hours (requires Azure Storage)

### Data Retrieval
- `GET /api/fetch-properties` - Get properties from OwnerRez (test)
- `GET /api/fetch-bookings?property_ids={ids}` - Get bookings (test)

### Reporting
- `GET /api/tax-report?from={date}&to={date}` - JSON tax summary
- `GET /api/tax-report-csv?from={date}&to={date}` - CSV export

### Testing
- `GET /api/test-ownerrez` - Verify API connection

## Authentication Flow

### Development (PAT)
```
Authorization: Basic {base64(email:pat)}
Username: jerry@***REMOVED***
Password: Personal Access Token
```

### Production (OAuth)
1. Frontend calls `/api/oauth/initiate?email={email}`
2. Redirect user to OwnerRez authorization
3. OwnerRez redirects to `/api/oauth/callback`
4. Exchange code for tokens, store in database
5. Use bearer token for API calls

## Environment Variables

### Required
```
OWNERREZ_PAT=               # Personal Access Token (dev)
DATABASE_URL=               # PostgreSQL connection
OWNERREZ_CLIENT_ID=         # OAuth client ID
OWNERREZ_CLIENT_SECRET=     # OAuth client secret
OAUTH_REDIRECT_URI=         # OAuth callback URL
```

### Local Development
```
DATABASE_URL=postgresql://postgres:localdev123@localhost:5432/baileys_analytics
OAUTH_REDIRECT_URI=http://localhost:7071/api/oauth/callback
```

## Data Flow

### Property Sync
1. Fetch from OwnerRez `/v2/properties`
2. Upsert to `properties` table with tenant isolation
3. Update existing, add new, preserve IDs

### Booking Sync
1. Fetch from OwnerRez `/v2/bookings` (last 7 days for updates)
2. Map OwnerRez property IDs to internal UUIDs
3. Transaction: upsert booking + replace all charges
4. Maintain data integrity with constraints

### Tax Reporting
1. Query bookings within date range
2. Join with charges where type = 'tax'
3. Aggregate by property and month
4. Calculate effective tax rates
5. Export as JSON or CSV

## Key Implementation Details

### Tenant Isolation
- Currently hardcoded: `00000000-0000-0000-0000-000000000001`
- Future: Derive from authenticated user
- All queries include tenant_id filter

### Error Handling
```typescript
type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### State Management
```typescript
type SyncState =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

### Transaction Pattern
```typescript
await transaction(async (client) => {
  // Multiple queries in single transaction
  // Automatic rollback on error
});
```

## Testing

### Local Setup
```bash
# Start PostgreSQL
docker run --name baileys-postgres \
  -e POSTGRES_PASSWORD=localdev123 \
  -e POSTGRES_DB=baileys_analytics \
  -p 5432:5432 -d postgres:15

# Apply schema
psql -h localhost -U postgres -d baileys_analytics -f schema.sql
psql -h localhost -U postgres -d baileys_analytics -f oauth-schema.sql

# Install and run
pnpm install
cd apps/functions
pnpm dev
```

### Test Endpoints
```bash
# Test connection
curl http://localhost:7071/api/test-ownerrez

# Sync data
curl -X POST http://localhost:7071/api/sync-properties
curl -X POST http://localhost:7071/api/sync-bookings

# Generate reports
curl "http://localhost:7071/api/tax-report?from=2024-01-01&to=2024-12-31"
curl "http://localhost:7071/api/tax-report-csv?from=2024-01-01&to=2024-12-31" -o report.csv
```

## Deployment Considerations

### Azure Requirements
- Azure Functions Premium plan (for timer triggers)
- Azure Database for PostgreSQL
- Azure Storage Account (for timer state)
- Application Insights (monitoring)

### Environment Setup
1. Create Azure resources
2. Configure connection strings
3. Deploy with VS Code or Azure CLI
4. Set up custom domain
5. Configure SSL certificates

## Future Enhancements

### Immediate
- JWT authentication for API endpoints
- React dashboard with Chart.js
- Tax configuration UI
- Automated email reports

### Long-term
- Webhook support for real-time updates
- Owner statement generation
- Multi-currency support
- API rate limiting
- Audit logging

## Common Issues

### Timer Trigger Not Working Locally
- Requires Azure Storage emulator or real storage account
- Use manual-sync endpoint for local testing

### OAuth Redirect Issues
- Ensure ngrok URL matches OAuth app settings
- Check CLIENT_ID and CLIENT_SECRET are set
- Verify redirect_uri is whitelisted in OwnerRez

### Database Connection Errors
- Check Docker container is running
- Verify no local PostgreSQL conflicts (port 5432)
- Ensure DATABASE_URL is correct

## Code Style Guide

### TypeScript Patterns
```typescript
// Discriminated unions over boolean flags
type State =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// Functional transformations
const results = data
  .filter(item => item.active)
  .map(transformItem)
  .sort(byDate);

// Explicit error handling
const result = await operation();
if (!result.success) {
  return { status: 'error', error: result.error };
}
```

### Avoid
- Unnecessary comments
- Emoji in code or messages
- Complex nested structures
- Implicit error handling
- Large functions (break into composable pieces)
