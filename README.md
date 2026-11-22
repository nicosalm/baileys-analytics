# Baileys Analytics

A dashboard for vacation rental hosts who use OwnerRez. It syncs a
host's properties, bookings, guests, owner blocks and inquiries, and
reports revenue and profit after fees and taxes, occupancy, booking
pace, cash flow, taxes and repeat guests. It runs at
baileysanalytics.com, which has a public demo.

## Architecture

- `web/` is a React single-page app on Cloudflare Pages.
- `api/` is a Cloudflare Worker built with Hono.
- Supabase provides Postgres and authentication.

The browser uses Supabase only to sign in. All data access goes through
the worker, which scopes every query to the caller's tenant
(`api/src/middleware/auth.ts`). The `anon` and `authenticated` roles
have no table grants. On the site, `/api` is a Pages Function that
proxies to the worker.

OwnerRez data arrives through an initial sync after OAuth, then through
webhooks. An hourly cron applies subscription changes, finishes account
deletions and removes old demo users. Billing uses Stripe.

## Layout

    web/                  React app
    web/functions/api/    Pages Function that proxies /api/* to the worker
    api/                  worker routes, services, middleware and cron
    packages/constants/   shared constants, including subscription tiers
    packages/utils/       shared date and currency helpers
    supabase/             migrations, demo seed and pre-deploy checks

## Development

Requires Node 22 or newer, pnpm (version pinned in `package.json`) and
a Supabase project. Connecting a real account requires an OwnerRez
developer app. Stripe and Resend are only needed for billing and email.

    pnpm install
    cp api/.dev.vars.example api/.dev.vars
    cp web/.env.example web/.env.local
    pnpm dev

Fill in both env files before running `pnpm dev`. The web app runs on
port 5173 and the worker on port 8787, and Vite proxies `/api` to the
worker.

The migrations in `supabase/migrations` build on the schema as of March
2026, which is not in the repository yet. A new Supabase project cannot
be set up from them alone.

    pnpm lint        Biome lint and format check
    pnpm format      apply Biome fixes
    pnpm typecheck   type-check every package
    pnpm test        worker tests (Vitest)
    pnpm build       production build of the web app

CI runs lint, type checks, tests and a build on every pull request.

## Deployment

Every push to `main` runs the "Deploy production" workflow. It builds
and tests, waits for approval on the `production` environment, deploys
the worker if `api/` changed, deploys the web app, and runs a smoke
test.

Migrations are applied by hand in the Supabase SQL editor after the
code that depends on them is live. If a migration changes grants,
indexes or functions, run `supabase/checks/pre-deploy-checks.sql`
first.

## Demo data

`supabase/seed-demo.sql` regenerates the demo tenant's bookings
relative to the current date. It is safe to run again.
