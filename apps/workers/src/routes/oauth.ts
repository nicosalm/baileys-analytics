import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';
import { EmailService } from '../services/email';

const oauth = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

oauth.get('/initiate', authMiddleware, async (c) => {
  const tenantId = c.get('tenantId');
  const user = c.get('user');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  
  // create a secure state token with expiration
  const stateData = {
    tenantId,
    userId: user.id,
    timestamp: Date.now(),
    nonce: crypto.randomUUID()
  };
  
  // store state in database for validation
  const stateToken = crypto.randomUUID();
  const { error: stateError } = await supabase
    .from('oauth_states')
    .insert({
      id: stateToken,
      tenant_id: tenantId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    });
    
  if (stateError) {
    console.error('Failed to create OAuth state:', stateError);
    return c.json({ error: 'Failed to initiate OAuth flow' }, 500);
  }
  
  const params = new URLSearchParams({
    client_id: c.env.OWNERREZ_CLIENT_ID,
    redirect_uri: `${c.env.FRONTEND_URL}/auth/callback`,
    response_type: 'code',
    scope: 'read',
    state: stateToken
  });

  const authUrl = `https://app.ownerrez.com/oauth/authorize?${params}`;
  
  return c.json({ authUrl });
});

oauth.post('/callback', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { code, state } = await c.req.json();

  if (!state || !code) {
    return c.json({ error: 'Missing required parameters' }, 400);
  }
  
  // validate state token from database
  const { data: oauthState, error: stateError } = await supabase
    .from('oauth_states')
    .select('tenant_id, user_id, expires_at')
    .eq('id', state)
    .single();
    
  if (stateError || !oauthState) {
    return c.json({ error: 'Invalid or expired state token' }, 400);
  }
  
  // check expiration
  if (new Date(oauthState.expires_at) < new Date()) {
    // clean up expired token
    await supabase.from('oauth_states').delete().eq('id', state);
    return c.json({ error: 'State token expired' }, 400);
  }
  
  // clean up used state token
  await supabase.from('oauth_states').delete().eq('id', state);
  
  const tenantId = oauthState.tenant_id;
  
  // validate tenant exists with retry for race condition
  let tenant = null;
  let retries = 3;
  
  while (retries > 0 && !tenant) {
    const { data } = await supabase
      .from('tenants')
      .select('id, user_id')
      .eq('id', tenantId)
      .single();
      
    if (data) {
      tenant = data;
    } else if (retries > 1) {
      // wait a bit for trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries--;
    } else {
      // last retry - try to create tenant if it doesn't exist
      const { data } = await supabase.auth.admin.getUserById(oauthState.user_id);
      if (data?.user) {
        const { data: createdTenant, error: createError } = await supabase
          .from('tenants')
          .insert({
            id: tenantId,
            user_id: oauthState.user_id,
            email: data.user.email || '',
            ownerrez_connected: false
          })
          .select()
          .single();
        if (createError) {
          // tenant was likely created by auth trigger between SELECT and INSERT — re-fetch
          const { data: refetched } = await supabase
            .from('tenants')
            .select('id, user_id')
            .eq('id', tenantId)
            .single();
          tenant = refetched;
        } else {
          tenant = createdTenant;
        }
      }
      retries--;
    }
  }
    
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 400);
  }

  try {
    const authString = btoa(`${c.env.OWNERREZ_CLIENT_ID}:${c.env.OWNERREZ_CLIENT_SECRET}`);
    
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
        'Authorization': `Basic ${authString}`,
        'User-Agent': 'Baileys-Analytics/1.0'
      },
      body: bodyParams.toString()
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json() as any;

    // get user info from ownerrez to get the user id
    let ownerrezUserId = tokenData.user_id;
    
    if (!ownerrezUserId && tokenData.access_token) {
      try {
        const userResponse = await fetch('https://api.ownerrez.com/v2/me', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
            'User-Agent': 'Baileys-Analytics/1.0'
          }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json() as any;
          ownerrezUserId = userData.id || userData.user_id;
        }
      } catch (error) {
        // fallback: continue without user id
      }
    }

    // calculate expiration time based on expires_in from token response
    // OwnerRez tokens are long-lived and never expire unless revoked,
    // so expires_in is typically absent. Default to 100 years.
    const expiresAt = new Date();
    if (tokenData.expires_in) {
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
    }

    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        tenant_id: tenantId,
        provider: 'ownerrez',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope || 'all',
        user_id: ownerrezUserId?.toString() || null,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,provider'
      });

    if (tokenError) {
      throw tokenError;
    }

    // update tenant with ownerrez user id for webhook mapping
    if (ownerrezUserId) {
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          ownerrez_user_id: ownerrezUserId,
          ownerrez_connected: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (tenantError) {
        // Handle UNIQUE constraint violation on ownerrez_user_id:
        // Another tenant already has this ownerrez_user_id (e.g., user re-registered
        // or switched accounts). Clear the old tenant's mapping first, then retry.
        const isUniqueViolation = tenantError.code === '23505' ||
          tenantError.message?.includes('unique') ||
          tenantError.message?.includes('duplicate');

        if (isUniqueViolation) {
          // Clear ownerrez_user_id from the old tenant that has it
          await supabase
            .from('tenants')
            .update({
              ownerrez_user_id: null,
              ownerrez_connected: false,
              updated_at: new Date().toISOString()
            })
            .eq('ownerrez_user_id', ownerrezUserId)
            .neq('id', tenantId);

          // Retry the update on the current tenant
          const { error: retryError } = await supabase
            .from('tenants')
            .update({
              ownerrez_user_id: ownerrezUserId,
              ownerrez_connected: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', tenantId);

          if (retryError) {
            console.error('Failed to update tenant with OwnerRez user ID after clearing old mapping:', retryError);
          }
        } else {
          console.error('Failed to update tenant with OwnerRez user ID:', tenantError);
        }
      }
    }

    // Mark that initial sync is needed
    await supabase
      .from('sync_status')
      .upsert({
        tenant_id: tenantId,
        sync_type: 'initial_sync_needed',
        last_sync: new Date().toISOString(),
        status: 'pending',
        records_synced: 0
      }, {
        onConflict: 'tenant_id,sync_type'
      });

    // send welcome email
    if (c.env.RESEND_API_KEY) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(oauthState.user_id);
        if (userData?.user?.email) {
          const emailService = new EmailService(c.env.RESEND_API_KEY);
          await emailService.sendWelcomeEmail(userData.user.email, userData.user.user_metadata?.name);
        }
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // don't fail the request if email fails
      }
    }

    return c.json({
      success: true,
      message: 'OwnerRez connected successfully'
    });
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
    // delete OAuth token
    const { error: deleteError } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'ownerrez');

    if (deleteError) {
      throw deleteError;
    }

    // clear all ownerrez connection fields on the tenant so the UI stops
    // showing the account as connected and the webhook handler stops routing
    // events here by ownerrez_user_id
    const { error: tenantError } = await supabase
      .from('tenants')
      .update({
        ownerrez_user_id: null,
        ownerrez_connected: false,
        ownerrez_disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    if (tenantError) {
      throw tenantError;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to disconnect OwnerRez'
    }, 500);
  }
});

export { oauth };