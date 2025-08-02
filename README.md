# Baileys Analytics

Multi-tenant vacation rental analytics platform with automated tax reporting, comprehensive dashboards, and real-time data visualization for OwnerRez users.

## Features

### Core Analytics
- **Automated Data Sync**: Properties and bookings sync from OwnerRez every 12 hours
- **Tax Reporting**: Detailed tax reports by property and month with CSV export
- **Property Analytics**: Performance metrics, occupancy rates, and revenue tracking
- **Revenue Insights**: Track income by source, visualize trends, and identify opportunities
- **Occupancy Analysis**: Monthly and property-level occupancy with seasonal patterns

### Advanced Features
- **Multi-Tag Filtering**: Filter all data by payment methods, property features, or custom tags
- **Drill-Down Navigation**: Click any data point for detailed views with breadcrumb navigation
- **Real-Time Calculations**: Accurate metrics updated with every sync
- **Multi-Tenant Architecture**: Complete data isolation between users
- **OAuth Integration**: Secure connection to OwnerRez accounts

## Quick Start

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL)
- pnpm 8+ (`npm install -g pnpm`)
- OwnerRez account with API access

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/baileys-analytics-platform.git
cd baileys-analytics-platform
pnpm install
```

### 2. Database Setup

```bash
# Start PostgreSQL
docker run --name baileys-postgres \
  -e POSTGRES_PASSWORD=localdev123 \
  -e POSTGRES_DB=baileys_analytics \
  -p 5432:5432 \
  -v baileys-postgres-data:/var/lib/postgresql/data \
  -d postgres:15

# Apply schemas
psql -h localhost -U postgres -d baileys_analytics -f schema.sql
psql -h localhost -U postgres -d baileys_analytics -f user-auth-schema.sql
psql -h localhost -U postgres -d baileys_analytics -f oauth-schema.sql
psql -h localhost -U postgres -d baileys_analytics -f tags-schema.sql
```

### 3. Configure Environment

Create `apps/functions/local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "OWNERREZ_PAT": "your-personal-access-token",
    "DATABASE_URL": "postgresql://postgres:localdev123@localhost:5432/baileys_analytics",
    "OWNERREZ_CLIENT_ID": "your-oauth-client-id",
    "OWNERREZ_CLIENT_SECRET": "your-oauth-client-secret",
    "JWT_SECRET": "your-secret-key",
    "FRONTEND_URL": "http://localhost:5173"
  }
}
```

### 4. Start Development

```bash
# Terminal 1 - Backend
cd apps/functions
pnpm dev

# Terminal 2 - Frontend
cd apps/web
pnpm dev
```

Visit http://localhost:5173

## Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts
- **Backend**: Azure Functions, Node.js, TypeScript
- **Database**: PostgreSQL 15
- **Auth**: JWT with refresh tokens
- **State**: React Context with discriminated unions

### Design Principles
- Functional programming with immutable data
- Discriminated unions for type-safe state
- Small, composable functions
- No unnecessary complexity
- Result types for explicit error handling

### Project Structure
```
apps/
  functions/     # Azure Functions backend
  web/          # React frontend
packages/
  shared-types/ # Shared TypeScript types
  constants/    # Shared constants
  utils/        # Utility functions
```

## Features in Detail

### Tax Reporting
- Calculate taxes by property and month
- Export detailed CSV reports
- Visual breakdown with charts
- Effective tax rate calculations

### Property Performance
- Revenue and occupancy metrics
- Comparison across properties
- Performance radar charts
- Drill-down to monthly details

### Revenue Analytics
- Gross vs net revenue tracking
- Platform source analysis
- Monthly trend visualization
- Growth rate calculations

### Occupancy Insights
- Overall and property-level rates
- Monthly occupancy trends
- Low season identification
- Visual heat maps (coming soon)

### Tag System
- Automatic tag sync from OwnerRez
- Multi-select filtering
- Tag type inference (payment, property, etc.)
- Usage analytics

### Drill-Down Navigation
- Click any chart element for details
- Property → Month → Booking hierarchy
- Breadcrumb navigation
- Context preservation

## API Documentation

See [TECHNICAL.md](TECHNICAL.md) for detailed API documentation.

## Deployment

### Azure Deployment
```bash
# Build and deploy functions
cd apps/functions
pnpm build
func azure functionapp publish your-function-app-name

# Build and deploy frontend
cd apps/web
pnpm build
# Deploy dist/ to Azure Static Web Apps or your preferred host
```

### Environment Variables
Required for production:
- `OWNERREZ_PAT`: Personal Access Token from OwnerRez
- `OWNERREZ_CLIENT_ID`: OAuth app client ID
- `OWNERREZ_CLIENT_SECRET`: OAuth app secret
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Strong secret for JWT signing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding principles (functional, immutable, type-safe)
4. Add tests for new features
5. Submit a pull request

## License

MIT - See [LICENSE](LICENSE) file
