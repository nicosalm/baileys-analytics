import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';

const debug = new Hono<{ Bindings: Env; Variables: { user: any } }>();

debug.use('/*', authMiddleware);

// debug endpoint to check oauth token and test api
debug.get('/oauth-status', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const user = c.get('user');
  
  try {
    // get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (!tenant) {
      return c.json({ error: 'No tenant found' });
    }
    
    // get oauth token
    const { data: oauthToken } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('provider', 'ownerrez')
      .single();
    
    if (!oauthToken) {
      return c.json({ 
        error: 'No OAuth token found',
        tenant_id: tenant.id,
        ownerrez_user_id: tenant.ownerrez_user_id
      });
    }
    
    // test the token with ownerrez api
    const testResponse = await fetch('https://api.ownerrez.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${oauthToken.access_token}`,
        'Accept': 'application/json',
        'User-Agent': 'Baileys-Analytics/1.0'
      }
    });
    
    const meData = testResponse.ok ? await testResponse.json() : null;
    
    // try to fetch properties
    const propertiesResponse = await fetch('https://api.ownerrez.com/v2/properties?active=true', {
      headers: {
        'Authorization': `Bearer ${oauthToken.access_token}`,
        'Accept': 'application/json',
        'User-Agent': 'Baileys-Analytics/1.0'
      }
    });
    
    const propertiesData = propertiesResponse.ok ? await propertiesResponse.json() : null;
    const propertiesError = !propertiesResponse.ok ? await propertiesResponse.text() : null;
    
    // check local database
    const { data: localProperties } = await supabase
      .from('properties')
      .select('*')
      .eq('tenant_id', tenant.id);
    
    return c.json({
      tenant: {
        id: tenant.id,
        ownerrez_user_id: tenant.ownerrez_user_id,
        ownerrez_connected: tenant.ownerrez_connected
      },
      oauth_token: {
        exists: true,
        provider: oauthToken.provider,
        user_id: oauthToken.user_id,
        expires_at: oauthToken.expires_at,
        created_at: oauthToken.created_at
      },
      api_test: {
        me_endpoint: {
          status: testResponse.status,
          ok: testResponse.ok,
          data: meData
        },
        properties_endpoint: {
          status: propertiesResponse.status,
          ok: propertiesResponse.ok,
          data: propertiesData,
          error: propertiesError
        }
      },
      local_data: {
        properties_count: localProperties?.length || 0,
        properties: localProperties
      }
    });
    
  } catch (error: any) {
    return c.json({ 
      error: 'Debug failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// test manual property fetch
debug.post('/test-fetch-properties', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const user = c.get('user');
  
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (!tenant) {
      return c.json({ error: 'No tenant found' });
    }
    
    const { data: oauthToken } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('tenant_id', tenant.id)
      .eq('provider', 'ownerrez')
      .single();
    
    if (!oauthToken?.access_token) {
      return c.json({ error: 'No OAuth token found' });
    }
    
    // import ownerrez service
    const { OwnerRezService } = await import('../services/ownerrez');
    const ownerRez = new OwnerRezService(oauthToken.access_token);
    
    // try to fetch properties
    const properties = await ownerRez.fetchProperties();
    
    // save them
    let savedCount = 0;
    for (const property of properties) {
      const { error } = await supabase
        .from('properties')
        .upsert({
          tenant_id: tenant.id,
          ownerrez_id: property.id,
          name: property.name,
          address: property.address?.street1 || property.address,
          city: property.address?.city,
          state: property.address?.state,
          postal_code: property.address?.postal_code,
          bedrooms: property.bedrooms || 0,
          bathrooms: property.bathrooms || 0,
          max_guests: property.max_guests || 0,
          active: property.active !== false,
          latitude: property.latitude,
          longitude: property.longitude,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,ownerrez_id',
          ignoreDuplicates: false
        });
      
      if (!error) savedCount++;
    }
    
    return c.json({
      success: true,
      fetched: properties.length,
      saved: savedCount,
      properties: properties
    });
    
  } catch (error: any) {
    return c.json({ 
      error: 'Property fetch failed',
      message: error.message,
      details: error.response?.data || error
    });
  }
});

debug.get('/check-oauth', authMiddleware, async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');

	const { data: tenant } = await supabase
		.from('tenants')
		.select('*')
		.eq('user_id', user.id)
		.single();

	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const { data: token } = await supabase
		.from('oauth_tokens')
		.select('*')
		.eq('tenant_id', tenant.id)
		.eq('provider', 'ownerrez')
		.single();

	return c.json({
		tenant: {
			id: tenant.id,
			company_name: tenant.company_name,
			ownerrez_connected: tenant.ownerrez_connected,
			ownerrez_user_id: tenant.ownerrez_user_id
		},
		oauth_token: token ? {
			exists: true,
			provider: token.provider,
			has_access_token: !!token.access_token,
			has_refresh_token: !!token.refresh_token,
			expires_at: token.expires_at,
			is_expired: token.expires_at ? new Date(token.expires_at) < new Date() : false,
			created_at: token.created_at,
			updated_at: token.updated_at
		} : {
			exists: false,
			message: 'No OwnerRez OAuth token found. Please connect OwnerRez in Settings.'
		}
	});
});

export { debug };