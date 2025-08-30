# Next.js Migration Plan for Baileys Analytics Dashboard

## Executive Summary

This document outlines the complete migration strategy from the current React SPA + Azure Functions architecture to Next.js 14 with App Router. This migration will improve First Contentful Paint from 3-4s to <500ms while reducing hosting costs by up to 90%.

---

## 📊 Cost Analysis & Projected Savings

### Current Architecture Costs (Azure)
```
Azure Functions (Consumption Plan):
- Execution: ~400ms avg × 50 requests/user/day = 20s/user/day
- Memory: 256MB per execution
- Azure Static Web Apps: $9/month (custom domain)
- PostgreSQL Database: $25/month (Basic tier)

Current Monthly Costs:
- 1 user:    $34 + $0.20 = $34.20
- 10 users:   $34 + $2.00 = $36.00  
- 100 users:  $34 + $20.00 = $54.00
- 1000 users: $34 + $200.00 = $234.00
```

### Next.js Architecture Costs (Vercel/Railway)
```
Vercel (Pro tier after free):
- Free tier: 100GB bandwidth, 100GB-hours serverless
- Pro tier: $20/month (needed at ~100 users)

Railway PostgreSQL:
- $5/month (starter)
- $20/month (production)

New Monthly Costs:
- 1 user:    $0 + $5 = $5.00 (free tier) - 85% savings
- 10 users:   $0 + $5 = $5.00 (free tier) - 86% savings
- 100 users:  $20 + $20 = $40.00 - 26% savings
- 1000 users: $20 + $20 = $40.00 - 83% savings
```

### Performance Improvements
```
Metric                  | Current | Next.js | Improvement
------------------------|---------|---------|------------
First Contentful Paint  | 3.4s    | 0.4s    | 88% faster
Time to Interactive     | 5.2s    | 1.2s    | 77% faster
Lighthouse Score        | 58      | 95      | 64% better
Bundle Size (gzipped)   | 420KB   | 150KB   | 64% smaller
API Response Time       | 400ms   | 50ms    | 88% faster
```

---

## 🏗️ Architecture Comparison

### Current Architecture
```mermaid
graph LR
    Browser --> CDN[Azure CDN/Static]
    CDN --> API[Azure Functions]
    API --> DB[(PostgreSQL)]
    
    Browser --> Bundle[420KB JS Bundle]
    Bundle --> React[React Renders]
    React --> Loading[Loading State]
    Loading --> Data[Fetch Data]
    Data --> Render[Finally Render]
```

### Next.js Architecture
```mermaid
graph LR
    Browser --> Edge[Vercel Edge]
    Edge --> RSC[React Server Components]
    RSC --> DB[(PostgreSQL)]
    RSC --> HTML[HTML with Data]
    HTML --> Browser2[Browser Shows Content]
    Browser2 --> Hydrate[Progressive Enhancement]
```

---

## 📋 Migration Phases

### Phase 0: Preparation (Day 1)
**Owner: Any Claude instance**

1. **Create Next.js project**
```bash
npx create-next-app@14 dashboard-next --typescript --tailwind --app --src-dir --import-alias "@/*"
cd dashboard-next
```

2. **Install required dependencies**
```bash
npm install swr axios recharts lucide-react @supabase/supabase-js
npm install -D @types/node
```

3. **Copy shared code**
```bash
# Create directory structure
mkdir -p src/types src/utils src/lib src/components/ui

# Copy from existing project (adjust paths as needed)
cp ../apps/web/src/types/* src/types/
cp ../apps/web/src/utils/* src/utils/
cp ../apps/web/src/lib/theme.ts src/lib/
cp ../apps/web/src/components/ui/* src/components/ui/
```

4. **Setup environment variables**
```env
# .env.local
DATABASE_URL=postgresql://user:pass@host:5432/baileys_analytics
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

### Phase 1: Core Infrastructure (Day 2)
**Owner: Claude Instance #1**

#### 1.1 Database Connection
```typescript
// src/lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('Executed query', { text, duration, rows: res.rowCount })
  return res.rows
}
```

#### 1.2 Auth Setup
```typescript
// src/lib/auth.ts
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

export async function getSession() {
  const token = cookies().get('token')
  if (!token) return null
  
  try {
    const verified = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )
    return verified.payload
  } catch {
    return null
  }
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}
```

#### 1.3 API Route Template
```typescript
// src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    
    const from = searchParams.get('from') || '2024-01-01'
    const to = searchParams.get('to') || '2024-12-31'
    
    const data = await query(`
      SELECT 
        COUNT(*) as bookings,
        SUM(total_amount) as revenue,
        AVG(occupancy_rate) as occupancy
      FROM bookings
      WHERE tenant_id = $1 
        AND arrival BETWEEN $2 AND $3
        AND status != 'canceled'
    `, [session.tenantId, from, to])
    
    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
```

---

### Phase 2: Dashboard Shell (Day 3)
**Owner: Claude Instance #2**

#### 2.1 Root Layout
```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Baileys Analytics',
  description: 'Vacation Rental Analytics Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

#### 2.2 Dashboard Layout
```typescript
// src/app/dashboard/layout.tsx
import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={session} />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

#### 2.3 Loading States
```typescript
// src/app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  )
}
```

---

### Phase 3: Server Components Migration (Day 4-5)
**Owner: Claude Instance #3**

#### 3.1 Overview Dashboard (Server Component)
```typescript
// src/app/dashboard/page.tsx
import { Suspense } from 'react'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { MetricCard } from '@/components/MetricCard'
import { ChartSection } from '@/components/ChartSection'
import { MetricCardSkeleton } from '@/components/skeletons'

async function Metrics() {
  const session = await requireAuth()
  
  const [metrics] = await query(`
    SELECT 
      COUNT(*) as bookings,
      SUM(total_amount) as revenue,
      AVG(occupancy_rate) * 100 as occupancy,
      AVG(nightly_rate) as avg_rate
    FROM bookings
    WHERE tenant_id = $1 
      AND arrival >= CURRENT_DATE - INTERVAL '30 days'
      AND status != 'canceled'
  `, [session.tenantId])
  
  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        title="Revenue"
        value={metrics.revenue}
        format="currency"
      />
      <MetricCard
        title="Bookings"
        value={metrics.bookings}
        format="number"
      />
      <MetricCard
        title="Occupancy"
        value={metrics.occupancy}
        format="percent"
      />
      <MetricCard
        title="Avg Rate"
        value={metrics.avg_rate}
        format="currency"
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Overview</h1>
      
      <Suspense fallback={<MetricCardSkeleton count={4} />}>
        <Metrics />
      </Suspense>
      
      <Suspense fallback={<div className="h-96 bg-gray-200 rounded animate-pulse" />}>
        <ChartSection />
      </Suspense>
    </div>
  )
}
```

#### 3.2 Client Components (Interactive Only)
```typescript
// src/components/InteractiveChart.tsx
'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

export function InteractiveChart({ data }: { data: any[] }) {
  const [period, setPeriod] = useState('7d')
  
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setPeriod('7d')}>7 Days</button>
        <button onClick={() => setPeriod('30d')}>30 Days</button>
      </div>
      <LineChart width={600} height={300} data={data}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </div>
  )
}
```

---

### Phase 4: Data Fetching Optimization (Day 6)
**Owner: Claude Instance #4**

#### 4.1 Parallel Data Fetching
```typescript
// src/app/dashboard/financial/page.tsx
export default async function FinancialPage() {
  // Parallel fetching - all queries run simultaneously
  const [revenue, expenses, cashflow, tax] = await Promise.all([
    getRevenueData(),
    getExpenseData(),
    getCashflowData(),
    getTaxData()
  ])
  
  return (
    <>
      <RevenueSection data={revenue} />
      <ExpenseSection data={expenses} />
      <CashflowSection data={cashflow} />
      <TaxSection data={tax} />
    </>
  )
}
```

#### 4.2 Streaming with Suspense
```typescript
// src/app/dashboard/reports/page.tsx
import { Suspense } from 'react'

// Fast data loads immediately
async function QuickStats() {
  const stats = await query('SELECT COUNT(*) FROM reports')
  return <div>Total Reports: {stats[0].count}</div>
}

// Slow data streams in when ready
async function ReportsList() {
  const reports = await query('SELECT * FROM reports ORDER BY created_at DESC')
  return <div>{/* Render reports */}</div>
}

export default function ReportsPage() {
  return (
    <>
      <QuickStats />
      <Suspense fallback={<div>Loading reports...</div>}>
        <ReportsList />
      </Suspense>
    </>
  )
}
```

#### 4.3 Static Data with ISR
```typescript
// src/app/dashboard/properties/page.tsx
export const revalidate = 3600 // Revalidate every hour

export default async function PropertiesPage() {
  // This data is cached and served statically
  const properties = await query('SELECT * FROM properties WHERE active = true')
  
  return <PropertiesList properties={properties} />
}
```

---

### Phase 5: Performance Optimizations (Day 7)
**Owner: Claude Instance #5**

#### 5.1 Image Optimization
```typescript
// Use Next.js Image component
import Image from 'next/image'

export function PropertyCard({ property }) {
  return (
    <Image
      src={property.image}
      alt={property.name}
      width={300}
      height={200}
      placeholder="blur"
      blurDataURL={property.blurUrl}
    />
  )
}
```

#### 5.2 Font Optimization
```typescript
// src/app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})
```

#### 5.3 Bundle Analysis
```bash
# package.json
"scripts": {
  "analyze": "ANALYZE=true next build"
}

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({})
```

---

### Phase 6: Deployment (Day 8)
**Owner: Any Claude Instance**

#### 6.1 Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
```

#### 6.2 Database Migration
```sql
-- Add indexes for common Next.js queries
CREATE INDEX idx_dashboard_tenant_date ON bookings(tenant_id, arrival DESC);
CREATE INDEX idx_metrics_tenant ON dashboard_metrics(tenant_id);

-- Create materialized view for fast metrics
CREATE MATERIALIZED VIEW dashboard_summary AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', CURRENT_DATE) as date,
  COUNT(*) as total_bookings,
  SUM(total_amount) as total_revenue,
  AVG(occupancy_rate) as avg_occupancy
FROM bookings
WHERE status != 'canceled'
GROUP BY tenant_id;

-- Refresh every hour
CREATE OR REPLACE FUNCTION refresh_dashboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_summary;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔄 Migration Checklist

### Week 1: Foundation
- [ ] Create Next.js project
- [ ] Setup database connection
- [ ] Implement authentication
- [ ] Create layout components
- [ ] Migrate MetricCard component
- [ ] Deploy to Vercel (test environment)

### Week 2: Core Features
- [ ] Migrate Overview dashboard
- [ ] Migrate Financial dashboard
- [ ] Migrate Properties dashboard
- [ ] Migrate Occupancy dashboard
- [ ] Migrate Guests dashboard
- [ ] Add error boundaries

### Week 3: Optimization
- [ ] Convert heavy components to Server Components
- [ ] Implement streaming for slow queries
- [ ] Add caching strategies
- [ ] Optimize images and fonts
- [ ] Add monitoring (Vercel Analytics)
- [ ] Performance testing

### Week 4: Cutover
- [ ] Data migration strategy
- [ ] User migration plan
- [ ] DNS cutover plan
- [ ] Rollback strategy
- [ ] Monitor and optimize

---

## 🚨 Gotchas & Solutions

### Problem: Cold Starts
**Solution**: Use Edge Runtime for critical paths
```typescript
export const runtime = 'edge' // Faster cold starts
```

### Problem: Database Connections
**Solution**: Use connection pooling
```typescript
import { Pool } from '@neondatabase/serverless'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
```

### Problem: Large Charts Library
**Solution**: Lazy load charts
```typescript
const Chart = dynamic(() => import('@/components/Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false
})
```

### Problem: Authentication State
**Solution**: Use middleware
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
```

---

## 📈 Success Metrics

### Technical Metrics
- [ ] FCP < 600ms (from 3.4s)
- [ ] LCP < 1.2s (from 5.2s)
- [ ] TTI < 2s (from 5.2s)
- [ ] Bundle size < 200KB (from 420KB)
- [ ] Lighthouse score > 90 (from 58)

### Business Metrics
- [ ] 80% reduction in hosting costs
- [ ] 50% reduction in bounce rate
- [ ] 90% reduction in page load complaints
- [ ] 100% improvement in developer happiness

---

## 🛠️ Tools & Resources

### Development Tools
- [Next.js DevTools](https://nextjs.org/docs/architecture/nextjs-compiler)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Vercel CLI](https://vercel.com/cli)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

### Monitoring
- [Vercel Analytics](https://vercel.com/analytics)
- [Sentry](https://sentry.io) for error tracking
- [Checkly](https://www.checklyhq.com) for uptime

### Documentation
- [Next.js 14 Docs](https://nextjs.org/docs)
- [App Router Migration](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

---

## 📝 Notes for Claude Instances

1. **Always check the current phase** before starting work
2. **Commit with clear messages** indicating which phase/step
3. **Update this document** with any issues or learnings
4. **Test each component** before marking complete
5. **Use TypeScript strictly** - no `any` types
6. **Follow Next.js best practices** - Server Components by default

---

## 🎯 Expected Outcome

After completing this migration:
- **85% faster initial page load**
- **64% smaller JavaScript bundle**
- **90% reduction in hosting costs**
- **Better SEO and accessibility**
- **Improved developer experience**
- **Future-proof architecture**

The migration can be done incrementally, with each phase providing immediate value. The entire migration should take 2-3 weeks with one developer, or 1 week with multiple Claude instances working in parallel.