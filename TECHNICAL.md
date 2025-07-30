# Technical Documentation

## Architecture Overview

- **Backend**: Azure Functions v4 (Node.js)
- **Database**: PostgreSQL with multi-tenant isolation
- **Authentication**: JWT tokens with jose library
- **Frontend**: React + Vite + TypeScript (coming soon)
- **Package Manager**: pnpm monorepo

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/signup
Create a new user account.
```json
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "userId": "uuid",
  "email": "user@example.com",
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

#### POST /api/auth/login
Authenticate and receive tokens.
```json
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "userId": "uuid",
  "email": "user@example.com",
  "tenantId": "uuid|null",
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

#### POST /api/auth/refresh
Exchange refresh token for new token pair.
```json
Request:
{
  "refreshToken": "jwt..."
}

Response:
{
  "userId": "uuid",
  "email": "user@example.com",
  "tenantId": "uuid|null",
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

#### GET /api/auth/me
Get current user info (requires auth).
```
Headers:
Authorization: Bearer <accessToken>

Response:
{
  "id": "uuid",
  "email": "user@example.com",
  "tenantId": "uuid|null",
  "companyName": "string|null",
  "hasOwnerRezConnection": boolean,
  "createdAt": "ISO-8601"
}
```

### OAuth Endpoints

#### GET /api/oauth/initiate
Start OwnerRez OAuth flow (requires auth).
```
Headers:
Authorization: Bearer <accessToken>

Response:
{
  "status": "pending",
  "authUrl": "https://app.ownerrez.com/oauth/authorize?..."
}
```

#### GET /api/oauth/callback
OAuth redirect handler (browser-based).

### Data Sync Endpoints

#### POST /api/sync-properties
Sync all properties from OwnerRez (dev only).

#### POST /api/sync-bookings
Sync recent bookings from OwnerRez (dev only).

#### POST /api/manual-sync
Trigger full sync manually.

### Reporting Endpoints

#### GET /api/tax-report
Generate tax report (requires auth + OwnerRez connection).
```
Headers:
Authorization: Bearer <accessToken>

Query params:
- from: YYYY-MM-DD (default: 2024-01-01)
- to: YYYY-MM-DD (default: 2024-12-31)

Response:
{
  "status": "success",
  "data": {
    "summary": {
      "totalTax": number,
      "totalRent": number,
      "totalBookings": number,
      "dateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }
    },
    "byProperty": [...],
    "byMonth": [...]
  }
}
```

#### GET /api/tax-report-csv
Export tax report as CSV (requires auth + OwnerRez connection).

## Database Schema

### Core Tables
- `users` - User accounts with email/password
- `tenants` - OwnerRez accounts (one per user)
- `properties` - Vacation rental properties
- `bookings` - Reservation data
- `booking_charges` - Line items including taxes
- `tax_configs` - Custom tax rates (future)

### Auth Tables
- `refresh_tokens` - JWT refresh token storage
- `oauth_tokens` - OwnerRez OAuth tokens
- `oauth_states` - Temporary OAuth flow state

## Authentication Flow

1. User signs up with email/password
2. User logs in and receives JWT tokens
3. Access token (15 min) used for API calls
4. Refresh token (7 days) used to get new access token
5. User connects OwnerRez via OAuth
6. Tenant created and linked to user
7. User can now access tax reports

## Security

- Passwords hashed with SHA256 + salt
- JWT tokens signed with HS256
- Refresh tokens stored hashed in database
- All endpoints require HTTPS in production
- CORS configured for frontend origin

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# OwnerRez API
OWNERREZ_PAT=pat_xxxx              # For development
OWNERREZ_CLIENT_ID=c_xxxx          # OAuth client
OWNERREZ_CLIENT_SECRET=secret      # OAuth secret
OAUTH_REDIRECT_URI=https://...     # OAuth callback

# Security
JWT_SECRET=your-secret-key         # JWT signing key
FRONTEND_URL=http://localhost:5173 # CORS origin

# Azure
AZURE_STORAGE_CONNECTION_STRING=   # For timer triggers
```

## Development Tips

- Timer triggers require Azure Storage emulator
- Use `manual-sync` endpoint for local testing
- JWT tokens expire quickly (15 min) by design
- Check PostgreSQL is running on port 5432
- OwnerRez API uses Basic Auth, not Bearer

### Design Patterns
- Discriminated unions for state management
- Functional programming with immutable data transformations
- Result types for explicit error handling
- Small, composable functions
- No unnecessary comments or emojis

