# Deployment Guide

## Prerequisites
- Cloudflare account with Pages and Workers setup
- `wrangler` CLI installed and logged in (`wrangler login`)
- Node.js and pnpm installed

## Environment Setup

### Local Development (.env.local)
Create `apps/web/.env.local`:
```
VITE_API_URL=http://localhost:8787
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Workers Secrets (.dev.vars)
Create `apps/workers/.dev.vars`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
DATABASE_URL=your_database_url
OWNERREZ_CLIENT_ID=your_client_id
OWNERREZ_CLIENT_SECRET=your_client_secret
```

### Production Environment Variables

#### Cloudflare Workers Secrets
Set via wrangler CLI:
```bash
wrangler secret put SUPABASE_URL --env production
wrangler secret put SUPABASE_SERVICE_KEY --env production
wrangler secret put SUPABASE_ANON_KEY --env production
wrangler secret put DATABASE_URL --env production
wrangler secret put OWNERREZ_CLIENT_ID --env production
wrangler secret put OWNERREZ_CLIENT_SECRET --env production
```

#### Cloudflare Pages Variables
Set in Cloudflare Dashboard → Pages → Settings → Environment variables:
- `VITE_SUPABASE_URL`: Your Supabase URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

## Local Development

```bash
# Terminal 1: Start Workers
cd apps/workers
wrangler dev

# Terminal 2: Start Web App
cd apps/web
pnpm dev
```

- Workers API: http://localhost:8787
- Web App: http://localhost:5173

## Production Deployment

**IMPORTANT**: Only deploy from the `main` branch

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Deploy Workers API
./scripts/deploy-workers.sh

# Deploy Web Application
./scripts/deploy-web.sh
```

## URLs

### Production
- Frontend: https://baileys-dashboard.pages.dev
- Backend API: https://baileys-analytics-api-production.nicosalm.workers.dev
- API Proxy: `/api/*` requests are proxied via Cloudflare Functions

### Preview (auto-deployed on push)
- Frontend: Cloudflare Pages preview URL (see PR or deployment log)
- Backend: Use local development

### How API Routing Works
- Local: Direct to `localhost:8787` via env variable
- Production: `/api/*` → Cloudflare Functions → Workers API
- This allows the frontend to always use `/api/*` paths

## OwnerRez Configuration

Update OAuth redirect URLs:
- Production: `https://baileys-dashboard.pages.dev/auth/callback`
- Local dev: `http://localhost:5173/auth/callback`

## Branching Strategy

- `main` - Production deployments only
- `dev` - Integration branch, creates preview deployments
- `feature/*` - Feature branches, create preview deployments

See [BRANCHING.md](./BRANCHING.md) for detailed workflow.

## Troubleshooting

### Workers deployment fails
- Check you're on main branch
- Verify wrangler is logged in: `wrangler whoami`
- Check secrets are set: `wrangler secret list --env production`

### Pages deployment fails
- Check you're on main branch
- Verify build succeeds locally: `cd apps/web && pnpm build`
- Check environment variables in Cloudflare dashboard

### Local development issues
- Ensure .env.local exists in apps/web
- Ensure .dev.vars exists in apps/workers
- Check both services are running (Workers on 8787, Web on 5173)
