import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';

const oauth = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

oauth.get('/initiate', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  
  const params = new URLSearchParams({
    client_id: c.env.OWNERREZ_CLIENT_ID,
    redirect_uri: `${c.env.FRONTEND_URL}/oauth/callback`,
    response_type: 'code',
    scope: 'properties bookings',
    state: tenantId
  });

  const authUrl = `https://app.ownerrez.com/oauth/authorize?${params}`;
  
  return c.json({ authUrl });
});

oauth.post('/callback', authMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const { code, state } = await c.req.json();

  if (state !== tenantId) {
    return c.json({ error: 'Invalid state parameter' }, 400);
  }

  try {
    const tokenResponse = await fetch('https://app.ownerrez.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${c.env.OWNERREZ_CLIENT_ID}:${c.env.OWNERREZ_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${c.env.FRONTEND_URL}/oauth/callback`
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json() as any;

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const { error } = await supabase
      .from('oauth_tokens')
      .upsert({
        tenant_id: tenantId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id'
      });

    if (error) {
      throw error;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'OAuth callback failed' 
    }, 500);
  }
});

oauth.post('/refresh', authMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');

  try {
    const { data: tokenData, error: fetchError } = await supabase
      .from('oauth_tokens')
      .select('refresh_token')
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !tokenData?.refresh_token) {
      return c.json({ error: 'No refresh token found' }, 404);
    }

    const tokenResponse = await fetch('https://app.ownerrez.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${c.env.OWNERREZ_CLIENT_ID}:${c.env.OWNERREZ_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh token');
    }

    const newTokenData = await tokenResponse.json() as any;

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);

    const { error: updateError } = await supabase
      .from('oauth_tokens')
      .update({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw updateError;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'OAuth refresh failed' 
    }, 500);
  }
});

export { oauth };