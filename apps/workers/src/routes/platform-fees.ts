import { Hono } from 'hono';
import { createSupabaseClient } from '../services/supabase';
import { authMiddleware } from '../middleware/auth';

const platformFees = new Hono<{ Bindings: Env; Variables: { user: any } }>();

platformFees.use('*', authMiddleware);

platformFees.get('/', async (c) => {
  const user = c.get('user');
  const supabase = createSupabaseClient(c.env);
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  const tenantId = tenant.id;
  const propertyId = c.req.query('property');
  const month = c.req.query('month');

  try {
    if (propertyId && month) {
      // Get platform fee entries for specific property and month
      const { data: entries, error: entriesError } = await supabase
        .from('platform_fee_entries')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('property_id', propertyId)
        .eq('month', month);
      
      if (entriesError) throw entriesError;
      
      // Get bookings for the month to calculate suggested fees
      const monthStart = `${month}-01`;
      const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0)
        .toISOString().split('T')[0];
      
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('platform, total_amount')
        .eq('tenant_id', tenantId)
        .eq('property_id', propertyId)
        .gte('arrival', monthStart)
        .lte('arrival', monthEnd)
        .neq('status', 'canceled');
      
      if (bookingsError) throw bookingsError;
      
      // Group bookings by platform
      const platformSummary = new Map();
      bookings?.forEach(booking => {
        const platform = booking.platform || 'Direct';
        if (!platformSummary.has(platform)) {
          platformSummary.set(platform, {
            platform,
            bookingCount: 0,
            totalRevenue: 0
          });
        }
        const summary = platformSummary.get(platform);
        summary.bookingCount++;
        summary.totalRevenue += booking.total_amount || 0;
      });
      
      // Combine with existing entries
      const result = Array.from(platformSummary.values()).map(summary => {
        const existingEntry = entries?.find(e => e.platform === summary.platform);
        return {
          ...summary,
          id: existingEntry?.id,
          propertyId,
          month,
          feeAmount: existingEntry?.fee_amount || 0,
          platformTaxRemitted: existingEntry?.platform_tax_remitted || 0,
          notes: existingEntry?.notes || '',
          hasEntry: !!existingEntry
        };
      });
      
      return c.json({ 
        status: 'success', 
        data: result 
      });
    } else {
      // Get general platform fee configurations
      const { data, error } = await supabase
        .from('platform_fee_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('platform');

      if (error) throw error;

      return c.json(data || []);
    }
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch platform fee data' 
    }, 500);
  }
});

platformFees.post('/', async (c) => {
  const user = c.get('user');
  const supabase = createSupabaseClient(c.env);
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  const tenantId = tenant.id;
  const body = await c.req.json();

  // Check if this is a platform fee entry or configuration
  if (body.propertyId && body.month && body.platform) {
    // This is a platform fee entry
    try {
      // Check if entry already exists
      const { data: existing } = await supabase
        .from('platform_fee_entries')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('property_id', body.propertyId)
        .eq('month', body.month)
        .eq('platform', body.platform)
        .single();
      
      let result;
      if (existing) {
        // Update existing entry
        const { data, error } = await supabase
          .from('platform_fee_entries')
          .update({
            fee_amount: body.feeAmount || 0,
            platform_tax_remitted: body.platformTaxRemitted || 0,
            notes: body.notes || '',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Create new entry
        const { data, error } = await supabase
          .from('platform_fee_entries')
          .insert({
            tenant_id: tenantId,
            property_id: body.propertyId,
            month: body.month,
            platform: body.platform,
            fee_amount: body.feeAmount || 0,
            platform_tax_remitted: body.platformTaxRemitted || 0,
            notes: body.notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }
      
      return c.json({ status: 'success', data: result }, 201);
    } catch (error) {
      return c.json({ 
        error: error instanceof Error ? error.message : 'Failed to save platform fee entry' 
      }, 500);
    }
  } else {
    // This is a platform fee configuration
    const { platform, feeType, feeValue, active = true } = body;

    try {
      const { data, error } = await supabase
        .from('platform_fee_configs')
        .insert({
          tenant_id: tenantId,
          platform,
          fee_type: feeType,
          fee_value: feeValue,
          active
        })
        .select()
        .single();

      if (error) throw error;

      return c.json(data, 201);
    } catch (error) {
      return c.json({ 
        error: error instanceof Error ? error.message : 'Failed to create platform fee configuration' 
      }, 500);
    }
  }
});

platformFees.put('/:id', async (c) => {
  const user = c.get('user');
  const supabase = createSupabaseClient(c.env);
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  const tenantId = tenant.id;
  const feeId = c.req.param('id');
  const body = await c.req.json();

  try {
    const { data, error } = await supabase
      .from('platform_fee_configs')
      .update({
        fee_type: body.feeType,
        fee_value: body.feeValue,
        active: body.active,
        updated_at: new Date().toISOString()
      })
      .eq('id', feeId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return c.json({ error: 'Configuration not found' }, 404);
    }

    return c.json(data);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to update platform fee configuration' 
    }, 500);
  }
});

platformFees.delete('/:id', async (c) => {
  const user = c.get('user');
  const supabase = createSupabaseClient(c.env);
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  const tenantId = tenant.id;
  const feeId = c.req.param('id');

  try {
    const { error } = await supabase
      .from('platform_fee_configs')
      .delete()
      .eq('id', feeId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete platform fee configuration' 
    }, 500);
  }
});

platformFees.get('/calculate', async (c) => {
  const user = c.get('user');
  const supabase = createSupabaseClient(c.env);
  
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  const tenantId = tenant.id;
  
  const from = c.req.query('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const to = c.req.query('to') || new Date().toISOString().split('T')[0];

  try {
    const [bookingsResult, configsResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('platform, total_amount')
        .eq('tenant_id', tenantId)
        .gte('arrival', from)
        .lte('arrival', to)
        .neq('status', 'canceled'),
      
      supabase
        .from('platform_fee_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
    ]);

    if (bookingsResult.error) throw bookingsResult.error;
    if (configsResult.error) throw configsResult.error;

    const configs = new Map();
    (configsResult.data || []).forEach(config => {
      configs.set(config.platform, config);
    });

    const feesByPlatform = new Map();
    
    (bookingsResult.data || []).forEach(booking => {
      const platform = booking.platform || 'Direct';
      const config = configs.get(platform);
      
      if (!feesByPlatform.has(platform)) {
        feesByPlatform.set(platform, {
          platform,
          bookings: 0,
          revenue: 0,
          fees: 0
        });
      }
      
      const platformData = feesByPlatform.get(platform);
      platformData.bookings += 1;
      platformData.revenue += booking.total_amount;
      
      if (config) {
        const fee = config.fee_type === 'percentage' 
          ? booking.total_amount * config.fee_value
          : config.fee_value;
        platformData.fees += fee;
      }
    });

    const results = Array.from(feesByPlatform.values())
      .sort((a, b) => b.revenue - a.revenue);

    return c.json({
      period: { from, to },
      platforms: results,
      summary: {
        totalRevenue: results.reduce((sum, p) => sum + p.revenue, 0),
        totalFees: results.reduce((sum, p) => sum + p.fees, 0),
        totalBookings: results.reduce((sum, p) => sum + p.bookings, 0)
      }
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to calculate platform fees' 
    }, 500);
  }
});

export { platformFees };