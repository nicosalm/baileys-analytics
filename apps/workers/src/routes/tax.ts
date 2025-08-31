import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';

const tax = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

tax.use('*', authMiddleware);

tax.get('/jurisdictions', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  
  try {
    const { data, error } = await supabase
      .from('tax_jurisdictions')
      .select('*')
      .order('state, county, city');

    if (error) throw error;

    return c.json(data || []);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch tax jurisdictions' 
    }, 500);
  }
});

tax.post('/auto-detect', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const { propertyId } = await c.req.json();

  try {
    const { data: property } = await supabase
      .from('properties')
      .select('address, city, state, zip')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single();

    if (!property) {
      return c.json({ error: 'Property not found' }, 404);
    }

    const { data: jurisdictions } = await supabase
      .from('tax_jurisdictions')
      .select('*')
      .eq('state', property.state)
      .ilike('city', `%${property.city}%`);

    const detectedConfigs = (jurisdictions || []).map(j => ({
      jurisdiction_id: j.id,
      name: j.name,
      type: j.type,
      rate: j.rate,
      suggested: true
    }));

    return c.json({ 
      property,
      detectedConfigs 
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to auto-detect tax configurations' 
    }, 500);
  }
});

tax.get('/property-configs/:propertyId', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const propertyId = c.req.param('propertyId');

  try {
    const { data, error } = await supabase
      .from('property_tax_configs')
      .select(`
        *,
        tax_jurisdictions!inner(*)
      `)
      .eq('property_id', propertyId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return c.json(data || []);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch property tax configurations' 
    }, 500);
  }
});

tax.post('/property-configs', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const body = await c.req.json();

  const { propertyId, jurisdictionId, customRate, active = true } = body;

  try {
    const { data, error } = await supabase
      .from('property_tax_configs')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        jurisdiction_id: jurisdictionId,
        custom_rate: customRate,
        active
      })
      .select()
      .single();

    if (error) throw error;

    return c.json(data, 201);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create tax configuration' 
    }, 500);
  }
});

tax.put('/property-configs/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const configId = c.req.param('id');
  const body = await c.req.json();

  try {
    const { data, error } = await supabase
      .from('property_tax_configs')
      .update({
        custom_rate: body.customRate,
        active: body.active,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId)
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
      error: error instanceof Error ? error.message : 'Failed to update tax configuration' 
    }, 500);
  }
});

tax.delete('/property-configs/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const configId = c.req.param('id');

  try {
    const { error } = await supabase
      .from('property_tax_configs')
      .delete()
      .eq('id', configId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete tax configuration' 
    }, 500);
  }
});

tax.get('/report', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  
  const year = parseInt(c.req.query('year') || new Date().getFullYear().toString());
  const quarter = c.req.query('quarter') ? parseInt(c.req.query('quarter')!) : undefined;

  try {
    let startDate, endDate;
    
    if (quarter) {
      startDate = new Date(year, (quarter - 1) * 3, 1);
      endDate = new Date(year, quarter * 3, 0);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    }

    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        total_amount,
        arrival,
        property_id,
        properties!inner(name, state, city)
      `)
      .eq('tenant_id', tenantId)
      .gte('arrival', startDate.toISOString())
      .lte('arrival', endDate.toISOString())
      .neq('status', 'canceled');

    const { data: taxConfigs } = await supabase
      .from('property_tax_configs')
      .select(`
        property_id,
        custom_rate,
        tax_jurisdictions!inner(name, type, rate)
      `)
      .eq('tenant_id', tenantId)
      .eq('active', true);

    const taxByProperty = new Map();
    const taxByJurisdiction = new Map();

    (bookings || []).forEach((booking: any) => {
      const configs = (taxConfigs || []).filter(tc => tc.property_id === booking.property_id);
      
      configs.forEach((config: any) => {
        const rate = config.custom_rate || config.tax_jurisdictions?.rate;
        const taxAmount = booking.total_amount * rate;
        
        const propKey = booking.property_id;
        const jurKey = config.tax_jurisdictions?.name;
        
        if (!taxByProperty.has(propKey)) {
          taxByProperty.set(propKey, {
            propertyName: booking.properties?.name,
            totalRevenue: 0,
            totalTax: 0
          });
        }
        
        if (!taxByJurisdiction.has(jurKey)) {
          taxByJurisdiction.set(jurKey, {
            name: config.tax_jurisdictions?.name,
            type: config.tax_jurisdictions?.type,
            totalTax: 0
          });
        }
        
        taxByProperty.get(propKey).totalRevenue += booking.total_amount;
        taxByProperty.get(propKey).totalTax += taxAmount;
        taxByJurisdiction.get(jurKey).totalTax += taxAmount;
      });
    });

    return c.json({
      period: { year, quarter },
      byProperty: Array.from(taxByProperty.values()),
      byJurisdiction: Array.from(taxByJurisdiction.values()),
      summary: {
        totalRevenue: Array.from(taxByProperty.values()).reduce((sum, p) => sum + p.totalRevenue, 0),
        totalTax: Array.from(taxByProperty.values()).reduce((sum, p) => sum + p.totalTax, 0)
      }
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate tax report' 
    }, 500);
  }
});

export { tax };