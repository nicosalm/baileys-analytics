# Baileys Analytics

Analytics for vacation rental hosts on OwnerRez. Connect an OwnerRez
account and it pulls in your properties, bookings and guests, then shows
revenue, occupancy, booking pace, cash flow and taxes. Live at
[baileysanalytics.com](https://baileysanalytics.com), with a demo if you
don't have an account.

## Stack

React on Cloudflare Pages, a Hono API on Cloudflare Workers, and
Supabase for Postgres and auth.

The frontend only talks to Supabase to log in. Everything else goes
through the worker, which checks the user's token and limits each query
to their tenant (`api/src/middleware/auth.ts`). After the first sync,
OwnerRez webhooks keep the data up to date.

## Layout

    web/            frontend
    web/functions/  /api proxy to the worker
    api/            the worker
    packages/       shared constants and utils
    supabase/       migrations and the demo seed

## Running locally

You'll need Node 22+, pnpm and a Supabase project. Connecting a real
OwnerRez account also needs an OwnerRez developer app.

    pnpm install
    cp api/.dev.vars.example api/.dev.vars
    cp web/.env.example web/.env.local
    pnpm dev

Fill in both env files first. The app runs on localhost:5173 and the
worker on :8787.

The migrations start from the March 2026 schema, which isn't checked in
yet, so you can't build a fresh database from them alone.

CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` on
pull requests.
