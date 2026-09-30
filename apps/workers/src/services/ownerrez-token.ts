import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from './supabase';

type TokenResult =
  | { accessToken: string; error?: never }
  | { accessToken?: never; error: { message: string; status: 400 } };

type TokenRow = { access_token: string; refresh_token: string | null; expires_at: string };

const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Returns a usable OwnerRez access token for the given tenant, refreshing it when it
 * is within REFRESH_SKEW_MS of expiry. Tokens under OwnerRez's "Standard" expiration
 * policy last 30 days and carry a refresh token; legacy permanent tokens have none
 * and are returned as-is.
 */
export async function getValidOwnerRezToken(
  env: Env,
  tenantId: string
): Promise<TokenResult> {
  const supabase = createSupabaseClient(env);

  const row = await readToken(supabase, tenantId);
  if (!row) {
    return { error: { message: 'No OwnerRez connection found. Please connect to OwnerRez in Settings.', status: 400 } };
  }

  const msUntilExpiry = new Date(row.expires_at).getTime() - Date.now();
  if (!row.refresh_token || msUntilExpiry > REFRESH_SKEW_MS) {
    return { accessToken: row.access_token };
  }

  const refreshed = await requestRefresh(env, row.refresh_token);
  if (refreshed) {
    const { error } = await supabase
      .from('oauth_tokens')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || row.refresh_token,
        expires_at: expiresAtFrom(refreshed.expires_in),
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('provider', 'ownerrez');
    if (error) {
      console.error(`Failed to persist refreshed OwnerRez token for tenant ${tenantId}:`, error);
    }
    return { accessToken: refreshed.access_token };
  }

  // a concurrent request may have already rotated the token
  const latest = await readToken(supabase, tenantId);
  if (latest && latest.access_token !== row.access_token) {
    return { accessToken: latest.access_token };
  }

  // refresh failed (e.g. transient OwnerRez outage) but the current token still works
  if (msUntilExpiry > 0) {
    return { accessToken: row.access_token };
  }

  return { error: { message: 'Your OwnerRez connection has expired. Please reconnect OwnerRez in Settings.', status: 400 } };
}

async function readToken(supabase: SupabaseClient, tenantId: string): Promise<TokenRow | null> {
  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ownerrez')
    .single();

  return error || !data?.access_token ? null : data;
}

async function requestRefresh(
  env: Env,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  try {
    const response = await fetch('https://api.ownerrez.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${btoa(`${env.OWNERREZ_CLIENT_ID}:${env.OWNERREZ_CLIENT_SECRET}`)}`,
        'User-Agent': 'Baileys-Analytics/1.0'
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error(`OwnerRez token refresh failed: ${response.status} ${await response.text()}`);
      return null;
    }

    const data = await response.json() as any;
    return data?.access_token ? data : null;
  } catch (error) {
    console.error('OwnerRez token refresh errored:', error);
    return null;
  }
}

// mirrors the OAuth callback: no expires_in means a non-expiring token
function expiresAtFrom(expiresIn?: number): string {
  const expiresAt = new Date();
  if (expiresIn) {
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 100);
  }
  return expiresAt.toISOString();
}
