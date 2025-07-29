# Baileys Analytics

Multi-tenant vacation rental analytics platform with automated tax reporting for OwnerRez users.

## Features

- **Automated Data Sync**: Pulls properties and bookings from OwnerRez every 12 hours
- **Tax Reporting**: Generate detailed tax reports by property and month
- **CSV Export**: Download tax data for easy filing
- **Multi-tenant**: Each user's data is completely isolated
- **OAuth Integration**: Secure connection to OwnerRez accounts

## Quick Start

1. **Prerequisites**
   - Node.js 20+
   - Docker (for PostgreSQL)
   - pnpm (`npm install -g pnpm`)
   - OwnerRez account with API access

2. **Setup**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/baileys-analytics-platform.git
   cd baileys-analytics-platform

   # Run setup script
   ./setup.sh

   # Install dependencies
   pnpm install

   # Start database
   docker run --name baileys-postgres \
     -e POSTGRES_PASSWORD=localdev123 \
     -e POSTGRES_DB=baileys_analytics \
     -p 5432:5432 -d postgres:15

   # Apply database schema
   psql -h localhost -U postgres -d baileys_analytics -f schema.sql
   psql -h localhost -U postgres -d baileys_analytics -f oauth-schema.sql
   ```

3. **Configure**

   Add your credentials to `apps/functions/local.settings.json`:
   ```json
   {
     "Values": {
       "OWNERREZ_PAT": "your-personal-access-token",
       "DATABASE_URL": "postgresql://postgres:localdev123@localhost:5432/baileys_analytics",
       "OWNERREZ_CLIENT_ID": "your-oauth-client-id",
       "OWNERREZ_CLIENT_SECRET": "your-oauth-client-secret",
       "OAUTH_REDIRECT_URI": "http://localhost:7071/api/oauth/callback"
     }
   }
   ```

4. **Run**
   ```bash
   cd apps/functions
   pnpm dev
   ```

## Usage

### Sync Your Data

```bash
# Sync properties
curl -X POST http://localhost:7071/api/sync-properties

# Sync bookings
curl -X POST http://localhost:7071/api/sync-bookings
```

### Generate Tax Reports

```bash
# JSON report
curl "http://localhost:7071/api/tax-report?from=2024-01-01&to=2024-12-31"

# CSV export
curl "http://localhost:7071/api/tax-report-csv?from=2024-01-01&to=2024-12-31" -o taxes-2024.csv
```

## API Documentation

See [TECHNICAL.md](TECHNICAL.md) for detailed API documentation.

## License

MIT
