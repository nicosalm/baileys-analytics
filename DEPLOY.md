# Deployment Guide

## Prerequisites
- Cloudflare account
- `wrangler` CLI logged in (`wrangler login`)

## Environment Variables

### Workers (.dev.vars)
```
SUPABASE_URL=https://ojpmtekljijcurgzrses.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
DATABASE_URL=your_database_url
OWNERREZ_CLIENT_ID=your_client_id
OWNERREZ_CLIENT_SECRET=your_client_secret
```

### Cloudflare Pages Dashboard
Add these in Settings → Environment variables → Production:
- `VITE_SUPABASE_URL`: https://ojpmtekljijcurgzrses.supabase.co
- `VITE_SUPABASE_ANON_KEY`: your_anon_key

Both as "Plain text", not "Secret".

## Deploy Backend (Workers)
```bash
cd apps/workers
pnpm build
wrangler deploy --env production
```

## Deploy Frontend (Pages)
```bash
cd apps/web
VITE_SUPABASE_URL="your_url" VITE_SUPABASE_ANON_KEY="your_key" pnpm build
wrangler pages deploy dist --project-name=baileys-dashboard --branch=main
```

## URLs
- Frontend: https://baileys-dashboard.pages.dev
- Backend: https://baileys-analytics-api-production.nicosalm.workers.dev

## OwnerRez Setup
Update OAuth redirect URL to: `https://baileys-dashboard.pages.dev/auth/callback`

## Quick Redeploy
```bash
# Backend
cd apps/workers && wrangler deploy --env production

# Frontend (with env vars baked in)
cd apps/web && VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." pnpm build && wrangler pages deploy dist --project-name=baileys-dashboard --branch=main
```