# Baileys Analytics

Baileys Analytics is a dashboard for vacation rental hosts who run
their business on OwnerRez. It connects to a host's OwnerRez account,
keeps a copy of their properties, bookings, guests, owner blocks and
inquiries, and turns that into the numbers hosts actually ask about:
revenue and profit after platform fees and taxes, occupancy measured
against the nights that could be sold, booking pace against last year,
cash flow, a tax summary, and which guests keep coming back. It runs at
baileysanalytics.com, where "Try the demo" opens a seeded account.

## How it works

There are two deployable pieces. `web/` is a React single-page app
served by Cloudflare Pages, and `api/` is a Cloudflare Worker built
with Hono. Supabase provides Postgres and sign-in.

The browser talks to Supabase only to sign in. Every read and write
goes through the worker, which uses the service role and scopes each
query to the tenant it resolves from the caller's token (see
`api/src/middleware/auth.ts`). The `anon` and `authenticated` roles
hold no table grants, so a user's session can't be used to query the
database directly. On the site, `/api` is a Pages Function that
forwards to the worker, so the app and its API share an origin.

When a host connects OwnerRez over OAuth, the browser drives an initial
sync in steps: properties, then four years of bookings and blocks, then
guests and inquiries. Each step is one request that handles a bounded
number of pages and hands back a cursor for the next, which keeps large
accounts under the worker's 30 second limit. After that, OwnerRez
webhooks keep the copy current, and Settings offers a full re-sync.

Each dashboard tab loads through a single batched endpoint,
`/api/dashboard-batch`, cached in Workers KV under a per-tenant key and
invalidated on every write, sync and webhook. Owner blocks are treated
as unavailable inventory, so occupancy divides booked nights by nights
that were actually for sale, in both the current and comparison
periods.

An hourly cron applies pending subscription tier changes in Stripe
shortly before each renewal, finishes account deletions that ran out of
time, and removes anonymous demo users older than 30 days. Billing is
Stripe Checkout plus the customer portal, with tiers priced by property
count (`packages/constants`).

## Layout

    web/                  React 19, Vite, Tailwind 4, shadcn/ui,
                          Recharts and SWR
    web/functions/api/    Pages Function that proxies /api/* to the
                          worker
    api/                  the worker: routes, services, middleware and
                          the cron entrypoint
    packages/constants/   shared constants, including subscription tiers
    packages/utils/       shared date and currency helpers
    supabase/             SQL migrations, the demo seed and pre-deploy
                          checks

## Running it locally

You need Node 22 or newer, pnpm (its version is pinned in
`package.json`) and a Supabase project. Connecting a real account also
needs an OwnerRez developer app for OAuth. Stripe and Resend are only
needed for billing and email.

    pnpm install
    cp api/.dev.vars.example api/.dev.vars
    cp web/.env.example web/.env.local
    pnpm dev

Fill in both env files before starting. `pnpm dev` serves the web app
on :5173 and the worker on :8787, and Vite proxies `/api` to the
worker. Set `API_URL` to point that proxy somewhere else.

The migrations in `supabase/migrations` begin in March 2026 and build
on the schema that existed then. That base schema is not in the
repository yet, so a fresh Supabase project can't be set up from the
migrations alone.

These commands cover the usual checks:

    pnpm lint        Biome lint and format check
    pnpm format      apply Biome fixes and formatting
    pnpm typecheck   type-check every package
    pnpm test        worker unit tests (Vitest)
    pnpm build       production build of the web app

A pre-commit hook runs Biome on staged files, and CI runs lint, type
checks, tests and a build on every pull request and push to `main`.

## Deploying

Production deploys from the "Deploy production" GitHub Actions
workflow, which is started by hand and asks for the confirmation text
`deploy prod`. It lints, type-checks and tests, deploys the worker,
then deploys the web app, and its smoke test checks that
baileysanalytics.com/api reports the commit it just deployed.

Migrations are applied by hand in the Supabase SQL editor, after the
code that depends on them is live. When a migration changes grants,
indexes or functions, run `supabase/checks/pre-deploy-checks.sql`
first.

## Demo data

`supabase/seed-demo.sql` regenerates the demo tenant's bookings
relative to today, three years back and a year ahead, so its charts
and booking pace always have data. It keeps the tenant, its
properties, guests and settings, and is safe to run again.
