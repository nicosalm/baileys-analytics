import { SUPABASE_MAX_ROWS } from '../constants';

// warns when a dashboard query returns exactly SUPABASE_MAX_ROWS rows, which
// is almost always a silent truncation at the postgrest db-max-rows cap. this
// is telemetry, not a fix: the point is to learn empirically which tenant and
// which service has outgrown the bounded query, so we can escalate that one
// call site to pagination or a server-side aggregate instead of preemptively
// refactoring every dashboard path.

interface TruncationContext {
  service: string;
  query: string;
  tenantId: string;
  from?: string;
  to?: string;
}

export function warnIfTruncated<T>(
  rows: T[] | null | undefined,
  context: TruncationContext
): void {
  if (rows && rows.length === SUPABASE_MAX_ROWS) {
    console.warn('[truncation-risk] query hit SUPABASE_MAX_ROWS', context);
  }
}
