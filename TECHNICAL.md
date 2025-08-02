# Technical Documentation

## Architecture Overview

Baileys Analytics is a multi-tenant vacation rental analytics platform built with modern web technologies and functional programming principles.

### Core Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts
- **Backend**: Azure Functions v4, Node.js 20, TypeScript
- **Database**: PostgreSQL 15 with UUID support
- **Authentication**: JWT with refresh token rotation
- **State Management**: React Context with discriminated unions

### Design Principles
1. **Functional Programming**: Pure functions, immutable data transformations
2. **Type Safety**: Discriminated unions for state management
3. **Error Handling**: Result types for explicit error handling
4. **Composability**: Small, focused functions that compose well
5. **No Magic**: Explicit over implicit, no hidden behavior

## Database Schema

### Core Tables
- `tenants`: Multi-tenant isolation (one per OwnerRez account)
- `users`: Authentication and user management
- `properties`: Vacation rental properties
- `bookings`: Reservations with guest information
- `booking_charges`: Line items including taxes and fees
- `tags`: Flexible categorization system
- `property_tags`, `booking_tags`: Many-to-many relationships

### Authentication Tables
- `refresh_tokens`: JWT refresh token storage
- `oauth_states`: Temporary OAuth flow state
- `oauth_tokens`: OwnerRez OAuth tokens per tenant

## API Endpoints

### Authentication
```
POST   /api/auth/signup         - Create new user account
POST   /api/auth/login          - Login with email/password
POST   /api/auth/refresh        - Refresh access token
GET    /api/auth/me            - Get current user info
POST   /api/auth/logout        - Revoke refresh tokens
```

### OAuth Integration
```
GET    /api/oauth/initiate     - Start OwnerRez OAuth flow
GET    /api/oauth/callback     - OAuth callback handler
```

### Data Sync
```
POST   /api/sync-properties    - Sync properties from OwnerRez
POST   /api/sync-bookings      - Sync bookings with charges
POST   /api/manual-sync        - Trigger full sync manually
GET    /api/sync-status        - Check last sync times
```

### Analytics Dashboards
```
GET    /api/tax-report         - Tax summary with filters
GET    /api/tax-report-csv     - Export tax report as CSV
GET    /api/property-metrics   - Property performance metrics
GET    /api/revenue            - Revenue analytics
GET    /api/occupancy          - Occupancy calculations
GET    /api/tags               - Available tags with usage
```

### Drill-Down Views
```
GET    /api/property/{id}/detail              - Property details with trends
GET    /api/booking/{id}/detail               - Full booking information
GET    /api/month-detail?year=&month=         - Monthly overview
GET    /api/property/{id}/month/{year}/{month} - Property-month intersection
```

### Query Parameters
All dashboard endpoints support:
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)
- `tags`: Comma-separated tag IDs for filtering

## Authentication Flow

### JWT Implementation
1. **Access Token**: 15-minute expiry, contains userId, email, tenantId
2. **Refresh Token**: 7-day expiry, stored in database with hash
3. **Auto-refresh**: Frontend refreshes tokens before expiry
4. **Secure Storage**: Tokens in memory, refresh token in httpOnly cookie (future)

### OAuth Flow
1. User initiates connection from dashboard
2. Generate state token, store with user email
3. Redirect to OwnerRez authorization
4. Callback verifies state, exchanges code for tokens
5. Create/update tenant, link to user
6. Store OAuth tokens for API access

## State Management

### Discriminated Unions Pattern
```typescript
type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; tokens: TokenPair }

type DrillDownLevel =
  | { type: 'root' }
  | { type: 'property'; propertyId: string; propertyName: string }
  | { type: 'month'; month: string; year: string }
  | { type: 'booking'; bookingId: string }
```

### Context Providers
- **AuthProvider**: Authentication state and methods
- **DashboardProvider**: Active tab and filter state
- **DrillDownProvider**: Navigation state and breadcrumbs
- **ToastProvider**: User notifications

## Data Flow

### Sync Process
1. **Properties Sync**
   - Fetch from OwnerRez with tags
   - Upsert properties maintaining relationships
   - Sync property tags

2. **Bookings Sync**
   - Fetch recent bookings (7 days by default)
   - Transaction: booking + charges + tags
   - Calculate derived metrics

3. **Auto-sync**
   - Timer trigger every 12 hours
   - Properties first, then bookings
   - Error resilience with partial success

### Tag System
1. **Tag Types**: property, booking, payment, guest, custom
2. **Type Inference**: Automatic based on name patterns
3. **Sync**: Tags created on first encounter
4. **Filtering**: Efficient EXISTS subqueries

## Performance Optimizations

### Database
- Comprehensive indexes on foreign keys and filters
- Materialized calculations in queries
- Connection pooling (20 connections max)
- Prepared statements for repeated queries

### Frontend
- Lazy loading of dashboard components
- On-demand data fetching for drill-downs
- Memoized calculations in components
- Debounced filter updates

### API
- Parallel query execution where possible
- Efficient date range calculations
- Minimal data transformation in handlers
- Result streaming for large datasets

## Security

### Authentication
- Bcrypt password hashing with salt
- JWT with HS256 signing
- Refresh token rotation
- Rate limiting on auth endpoints

### Data Isolation
- Tenant ID in all queries
- Row-level security via application
- No cross-tenant data access
- Cascade deletes maintain integrity

### API Security
- Bearer token authentication
- CORS with specific origins
- Input validation and sanitization
- SQL injection prevention via parameterized queries

## Error Handling

### Result Type Pattern
```typescript
type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

### Error Responses
- Consistent error format
- Appropriate HTTP status codes
- User-friendly error messages
- Detailed logging for debugging

## Testing Strategy

### Unit Tests
- Pure functions in utils package
- State reducers and transformations
- Date calculations and formatting

### Integration Tests
- API endpoint testing
- Database transaction verification
- OAuth flow simulation

### E2E Tests
- Complete user flows
- Drill-down navigation
- Data sync verification

## Deployment

### Azure Functions
- Node.js 20 runtime
- Consumption plan
- Application Insights integration
- Environment variables in App Settings

### Frontend
- Static site deployment
- CDN distribution
- Build optimization with Vite
- Environment-specific configs

### Database
- Azure Database for PostgreSQL
- Automated backups
- Connection string in Key Vault
- SSL enforcement

## Monitoring

### Application Insights
- Request tracking
- Custom metrics for sync
- Error tracking with context
- Performance monitoring

### Health Checks
- Database connectivity
- OwnerRez API availability
- Sync status monitoring
- Token expiry warnings

## Future Enhancements

### Planned Features
1. **Seasonal Analysis**: Year-over-year comparisons
2. **Guest Demographics**: Repeat guest tracking
3. **Financial Metrics**: P&L with expense tracking
4. **Mobile App**: React Native implementation
5. **Webhooks**: Real-time updates from OwnerRez

### Technical Improvements
1. **GraphQL API**: Replace REST with GraphQL
2. **Redis Cache**: Improve performance
3. **Event Sourcing**: Audit trail for all changes
4. **Microservices**: Split into domain services
5. **Kubernetes**: Container orchestration
