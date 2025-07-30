# Baileys Analytics

Multi-tenant vacation rental analytics platform with automated tax reporting for OwnerRez users.

## Features

- **User Authentication**: Secure signup/login with JWT tokens
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
   psql -h localhost -U postgres -d baileys_analytics -f user-auth-schema.sql
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
       "OAUTH_REDIRECT_URI": "http://localhost:7071/api/oauth/callback",
       "JWT_SECRET": "your-super-secret-jwt-key",
       "FRONTEND_URL": "http://localhost:5173"
     }
   }
   ```

4. **Run**
   ```bash
   cd apps/functions
   pnpm dev
   ```

## Usage

### Authentication

```bash
# Sign up
curl -X POST http://localhost:7071/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:7071/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Connect OwnerRez

After login, use the OAuth flow to connect your OwnerRez account:
```bash
# Get OAuth URL (requires auth token)
curl -X GET http://localhost:7071/api/oauth/initiate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Generate Tax Reports

```bash
# JSON report (requires auth + OwnerRez connection)
curl "http://localhost:7071/api/tax-report?from=2024-01-01&to=2024-12-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# CSV export
curl "http://localhost:7071/api/tax-report-csv?from=2024-01-01&to=2024-12-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o taxes-2024.csv
```

## API Documentation

See [TECHNICAL.md](TECHNICAL.md) for detailed API documentation.

## License

MIT
