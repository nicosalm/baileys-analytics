# Baileys Analytics Architecture

## Overview
Property management analytics dashboard for vacation rental owners using OwnerRez data.

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State Management**: Context API + SWR for data fetching
- **URL**: http://localhost:5173

### Backend
- **Runtime**: Azure Functions (Node.js)
- **Language**: TypeScript
- **API**: RESTful endpoints
- **URL**: http://localhost:7071/api

### Database
- **Provider**: Supabase (PostgreSQL)
- **Connection**: Direct connection (not using pgbouncer)
- **Project ID**: ojpmtekljijcurgzrses

### External Services
- **OwnerRez API**: Property management system integration
- **Authentication**: JWT-based with refresh tokens

## Development Setup

### Prerequisites
- Node.js 18+
- pnpm package manager
- Azure Functions Core Tools v4

### Environment Variables
Key environment variables in `apps/functions/local.settings.json`:
- `DATABASE_URL`: Supabase PostgreSQL connection string
- `OWNERREZ_PAT`: OwnerRez Personal Access Token
- `JWT_SECRET`: Secret for JWT signing
- `FRONTEND_URL`: Frontend URL for CORS

### Test Credentials
- **Email**: test@example.com
- **Password**: password123
- **Tenant**: Door County Stay

## Project Structure

```
/
├── apps/
│   ├── functions/    # Azure Functions backend
│   │   ├── src/      # Source code
│   │   │   ├── services/     # Business logic
│   │   │   ├── middleware/   # Auth, rate limiting
│   │   │   └── utils/        # Helpers
│   │   └── dist/     # Compiled JavaScript
│   └── web/          # React frontend
│       └── src/
│           ├── components/   # UI components
│           ├── pages/        # Route pages
│           ├── hooks/        # Custom hooks
│           └── contexts/     # React contexts
└── packages/
    └── shared-types/  # Shared TypeScript types

```

## Key Features

### Data Sync
- Properties sync from OwnerRez
- Bookings sync with configurable date ranges
- Guest details enrichment
- Tag-based property categorization

### Analytics
- Occupancy tracking and forecasting
- Financial metrics (revenue, ADR, RevPAR)
- Guest analytics and repeat guest tracking
- Seasonal analysis
- Tax calculations and reporting

### Reports
- Custom report builder
- PDF generation
- Scheduled reports
- Multiple export formats

## Database Schema

### Core Tables
- `users`: Authentication and user management
- `tenants`: Multi-tenant support
- `properties`: Property information from OwnerRez
- `bookings`: Reservation data
- `tags`: Property categorization
- `seasons`: Seasonal configuration
- `property_tax_configs`: Tax settings
- `report_templates`: Custom report configurations

## Deployment

### Local Development
```bash
# Install dependencies
pnpm install

# Start backend
cd apps/functions
pnpm run dev

# Start frontend (new terminal)
cd apps/web
pnpm run dev
```

### Production Considerations
- Migrate from Azure Functions to Cloudflare Workers (planned)
- Implement edge caching for better performance
- Use Supabase connection pooling for production
- Set up proper SMTP configuration for email reports

## Security
- JWT-based authentication with refresh tokens
- Tenant isolation via RLS policies
- Rate limiting on API endpoints
- Secure password hashing (bcrypt, 12 rounds)

## Monitoring
- Health check endpoint: `/api/health`
- Sync status tracking
- Error logging via Azure Functions context

## Future Improvements
- [ ] Migrate to Cloudflare Workers + Supabase
- [ ] Implement edge caching
- [ ] Add more visualization options
- [ ] Enhanced mobile responsiveness
- [ ] Real-time data updates via WebSockets