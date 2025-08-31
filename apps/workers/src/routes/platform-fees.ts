import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';

const platformFees = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

platformFees.use('*', authMiddleware);

platformFees.get('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');

  try {
    const { data, error } = await supabase
      .from('platform_fee_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('platform');

    if (error) throw error;

    return c.json(data || []);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch platform fee configurations' 
    }, 500);
  }
});

platformFees.post('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const body = await c.req.json();

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
});

platformFees.put('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
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
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
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
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  
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