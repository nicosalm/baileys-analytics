import { createSupabaseClient } from './supabase';

type TokenResult =
  | { accessToken: string; error?: never }
  | { accessToken?: never; error: { message: string; status: 400 } };

/**
 * Returns the OwnerRez access token for the given tenant.
 * OwnerRez tokens are long-lived and never expire unless revoked,
 * so no refresh logic is needed.
 */
export async function getValidOwnerRezToken(
  env: Env,
  tenantId: string
): Promise<TokenResult> {
  const supabase = createSupabaseClient(env);

  const { data: tokenRow, error: fetchError } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ownerrez')
    .single();

  if (fetchError || !tokenRow?.access_token) {
    return { error: { message: 'No OwnerRez connection found. Please connect to OwnerRez in Settings.', status: 400 } };
  }

  return { accessToken: tokenRow.access_token };
}
