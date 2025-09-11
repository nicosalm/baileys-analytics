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
    // ownerrez requires basic auth with client_id:client_secret
    const authString = btoa(`${c.env.OWNERREZ_CLIENT_ID}:${c.env.OWNERREZ_CLIENT_SECRET}`);
    
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${c.env.FRONTEND_URL}/auth/callback`
    });
    
    console.log('OwnerRez token exchange attempt:', {
      redirect_uri: `${c.env.FRONTEND_URL}/auth/callback`,
      code_prefix: code.substring(0, 10) + '...',
      client_id_prefix: c.env.OWNERREZ_CLIENT_ID.substring(0, 10) + '...'
    });
    
    const tokenResponse = await fetch('https://api.ownerrez.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
        'User-Agent': 'Baileys-Analytics/1.0'  // required to prevent 403
      },
      body: bodyParams.toString()
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OwnerRez token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        requestBody: {
          grant_type: 'authorization_code',
          code: code.substring(0, 10) + '...',
          redirect_uri: `${c.env.FRONTEND_URL}/auth/callback`,
          client_id: c.env.OWNERREZ_CLIENT_ID.substring(0, 10) + '...'
        }
      });
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
      // update user metadata using raw sql via rpc
      const { error: updateError } = await supabase.rpc('update_user_metadata', {
        user_id: tenantData.user_id,
        metadata: { has_ownerrez_connection: true }
      });

      if (updateError) {
        console.error('Failed to update user metadata via RPC:', updateError);
        
        // fallback: update users table directly if you have one
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ 
            has_ownerrez_connection: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantData.user_id);
          
        if (userUpdateError) {
          console.error('Failed to update users table:', userUpdateError);
        }
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