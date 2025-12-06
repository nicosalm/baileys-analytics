import { Toucan } from 'toucan-js';
import { Context } from 'hono';

export function createSentry(c: Context<{ Bindings: Env }>): Toucan | null {
  if (!c.env.SENTRY_DSN) {
    return null;
  }

  return new Toucan({
    dsn: c.env.SENTRY_DSN,
    context: c.executionCtx,
    request: c.req.raw,
    environment: c.env.FRONTEND_URL.includes('localhost') ? 'development' : 'production',
    tracesSampleRate: 1.0,
  });
}

export function setSentryUser(sentry: Toucan | null, userId: string, tenantId?: string) {
  if (!sentry) return;

  sentry.setUser({
    id: userId,
    ...(tenantId && { tenant_id: tenantId }),
  });
}
