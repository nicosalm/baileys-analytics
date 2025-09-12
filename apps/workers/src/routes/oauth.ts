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

  const tenantId = state;
  
  if (!tenantId) {
    return c.json({ error: 'Invalid state parameter' }, 400);
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

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);

    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        tenant_id: tenantId,
        provider: 'ownerrez',
        access_token: tokenData.access_token,
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
        // fallback: try minimal update
        const { error: minimalError } = await supabase
          .from('tenants')
          .update({
            ownerrez_user_id: ownerrezUserId,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId);
        
        if (minimalError) {
          console.error('Failed to update tenant with OwnerRez user ID:', minimalError);
        }
      }
    }

    // trigger initial data sync for new connections
    try {
      const { OwnerRezService } = await import('../services/ownerrez');
      const ownerRez = new OwnerRezService(tokenData.access_token);
      
      const properties = await ownerRez.fetchProperties();
      
      for (const property of properties) {
        await supabase
          .from('properties')
          .upsert({
            id: property.id,
            tenant_id: tenantId,
            ownerrez_property_id: property.id,
            name: property.name,
            address: property.address,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            max_guests: property.max_guests,
            active: property.active !== false,
            data: property,
            updated_at: new Date().toISOString()
          })
          .eq('ownerrez_property_id', property.id)
          .eq('tenant_id', tenantId);
      }
      await supabase
        .from('sync_status')
        .upsert({
          tenant_id: tenantId,
          sync_type: 'initial_properties',
          last_sync: new Date().toISOString(),
          status: 'success',
          records_synced: properties.length
        })
        .eq('tenant_id', tenantId)
        .eq('sync_type', 'initial_properties');
      
      return c.json({ 
        success: true, 
        initialSync: {
          triggered: true,
          propertiesSynced: properties.length,
          message: 'Initial property sync complete. Use manual sync to load bookings.'
        }
      });
    } catch (syncError) {
      // don't fail oauth if initial sync fails
      return c.json({ 
        success: true, 
        initialSync: {
          triggered: false,
          error: 'Initial sync failed. Please use manual sync.'
        }
      });
    }
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
    // Delete OAuth token
    const { error: deleteError } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'ownerrez');
    
    if (deleteError) {
      throw deleteError;
    }
    
    const { error: tenantError } = await supabase
      .from('tenants')
      .update({
        ownerrez_user_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to disconnect OwnerRez' 
    }, 500);
  }
});

export { oauth };