import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';

const oauth = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

oauth.get('/initiate', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  
  const params = new URLSearchParams({
    client_id: c.env.OWNERREZ_CLIENT_ID,
    redirect_uri: `${c.env.FRONTEND_URL}/auth/callback`,
    response_type: 'code',
    scope: 'properties bookings',
    state: tenantId
  });

  const authUrl = `https://app.ownerrez.com/oauth/authorize?${params}`;
  
  return c.json({ authUrl });
});

oauth.post('/callback', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { code, state } = await c.req.json();

  // state contains the tenant id
  const tenantId = state;
  
  if (!tenantId) {
    return c.json({ error: 'Invalid state parameter' }, 400);
  }

  try {
    // exchange authorization code for access token
    const authString = `${c.env.OWNERREZ_CLIENT_ID}:${c.env.OWNERREZ_CLIENT_SECRET}`;
    const authHeader = `Basic ${btoa(authString)}`;
    
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${c.env.FRONTEND_URL}/auth/callback`
    });
    
    const tokenResponse = await fetch('https://api.ownerrez.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: bodyParams.toString()
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json() as any;

    // ownerrez tokens don't expire, set far future date
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);

    const { error } = await supabase
      .from('oauth_tokens')
      .upsert({
        tenant_id: tenantId,
        provider: 'ownerrez',
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope || 'all',
        user_id: tokenData.user_id?.toString() || null,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,provider'
      });

    if (error) {
      throw error;
    }

    // update user metadata to indicate ownerrez connection
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('user_id')
      .eq('id', tenantId)
      .single();

    if (tenantData?.user_id) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        tenantData.user_id,
        {
          user_metadata: { has_ownerrez_connection: true }
        }
      );

      if (updateError) {
        throw new Error('Failed to update user metadata');
      }
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'OAuth callback failed' 
    }, 500);
  }
});

oauth.post('/disconnect', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  
  try {
    // delete the oauth token
    const { error: deleteError } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'ownerrez');
    
    if (deleteError) {
      throw deleteError;
    }
    
    // update user metadata to indicate no ownerrez connection
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('user_id')
      .eq('id', tenantId)
      .single();
    
    if (tenantData?.user_id) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        tenantData.user_id,
        {
          user_metadata: { has_ownerrez_connection: false }
        }
      );
      
      if (updateError) {
        console.error('Failed to update user metadata:', updateError);
      }
    }
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to disconnect OwnerRez' 
    }, 500);
  }
});

export { oauth };