# Baileys Analytics

Multi-tenant analytics for OwnerRez hosts: revenue, P&L, occupancy, booking pace, and guests, built from a host's OwnerRez data.

## Layout

| Path                 | What it is                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/`               | React 19 SPA (Vite, Tailwind 4, shadcn/ui, Recharts, SWR). Deployed to Cloudflare Pages; `web/functions/api` proxies `/api/*` to the worker. |
| `api/`               | Cloudflare Worker (Hono). Every database read and write goes through it with the Supabase service role, scoped by tenant.                    |
| `packages/constants` | Shared constants, including subscription tiers.                                                                                              |
| `packages/utils`     | Shared formatting and date helpers for the web app.                                                                                          |
| `supabase/`          | SQL migrations, the demo seed, and pre-deploy checks.                                                                                        |

The browser talks to Supabase for authentication only. Tenant isolation lives in the worker: every query filters by the tenant resolved in `api/src/middleware/auth.ts`.

## Development

Requires Node 22+ and pnpm (the version is pinned in `package.json`).

```sh
pnpm install
cp api/.dev.vars.example api/.dev.vars   # fill in secrets
cp web/.env.example web/.env.local       # fill in Supabase URL and anon key
pnpm dev                                 # web on :5173, api on :8787
```

Set `API_URL` to point the Vite proxy at an API on another port.

| Command          | Does                                                       |
| ---------------- | ---------------------------------------------------------- |
| `pnpm lint`      | Biome lint and format check                                |
| `pnpm format`    | Apply Biome fixes and formatting                           |
| `pnpm typecheck` | Type-check every package                                   |
| `pnpm test`      | API unit tests (Vitest)                                    |
| `pnpm build`     | Production build of the web app                            |
| `pnpm db:types`  | Regenerate `web/src/types/database.types.ts` from Supabase |

A pre-commit hook runs Biome on staged files.

## Deploying

Production deploys run from the **Deploy production** GitHub Actions workflow (manual, type `deploy prod` to confirm). It lints, type-checks, tests, deploys the worker, then deploys the web app and checks that `/api` reaches the worker.

Migrations in `supabase/migrations` are applied by hand in the Supabase SQL editor. Run `supabase/checks/pre-deploy-checks.sql` first when a migration changes grants, indexes, or functions.

## Demo data

`supabase/seed-demo.sql` regenerates the demo tenant's bookings relative to the current date (three years back, twelve months forward), so the demo's pacing and charts stay populated. It keeps the tenant, properties, guests, and any settings, and is safe to re-run.
