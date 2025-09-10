import { createClient } from '@supabase/supabase-js';
import { OWNERREZ_API } from './constants';

export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  
  // add timeout protection for scheduled jobs (5 minutes max)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  
  try {
    switch(event.cron) {
      case '0 2 * * *':
        await syncAllProperties(supabase, env);
        break;
      case '0 */6 * * *':
        await syncRecentBookings(supabase, env);
        break;
      case '0 0 1 * *':
        await generateMonthlyReports(supabase, env);
        break;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // scheduled job timeout after 5 minutes
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function syncAllProperties(supabase: any, env: Env) {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true);

  for (const tenant of tenants || []) {
    const { data: tokenData } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('tenant_id', tenant.id)
      .single();

    const token = tokenData?.access_token || env.OWNERREZ_PAT;
    if (!token) continue;

    const headers = token.startsWith('ey') 
      ? { Authorization: `Bearer ${token}` }
      : { Authorization: `Basic ${btoa(`test@example.com:${token}`)}` };

    const response = await fetch(`${OWNERREZ_API.BASE_URL}/properties`, { headers });
    if (!response.ok) continue;

    const data = await response.json() as any;
    const { items } = data;
    
    for (const property of items || []) {
      await supabase
        .from('properties')
        .upsert({
          ownerrez_id: property.id,
          tenant_id: tenant.id,
          name: property.name,
          address: property.address,
          active: property.active,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'ownerrez_id,tenant_id'
        });
    }
  }
}

async function syncRecentBookings(supabase: any, env: Env) {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true);

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const from = fromDate.toISOString().split('T')[0];

  for (const tenant of tenants || []) {
    const [tokenResult, propertiesResult] = await Promise.all([
      supabase.from('oauth_tokens').select('access_token').eq('tenant_id', tenant.id).single(),
      supabase.from('properties').select('ownerrez_id').eq('tenant_id', tenant.id)
    ]);

    const token = tokenResult.data?.access_token || env.OWNERREZ_PAT;
    if (!token || !propertiesResult.data?.length) continue;

    const propertyIds = propertiesResult.data.map((p: any) => p.ownerrez_id);
    const headers = token.startsWith('ey')
      ? { Authorization: `Bearer ${token}` }
      : { Authorization: `Basic ${btoa(`test@example.com:${token}`)}` };

    const params = new URLSearchParams({
      property_ids: propertyIds.join(','),
      from,
      include_charges: 'true'
    });

    const response = await fetch(`${OWNERREZ_API.BASE_URL}/bookings?${params}`, { headers });
    if (!response.ok) continue;

    const data = await response.json() as any;
    const { items } = data;

    for (const booking of items || []) {
      if (booking.is_block || booking.type === 'block') continue;

      const { data: property } = await supabase
        .from('properties')
        .select('id')
        .eq('ownerrez_id', booking.property_id)
        .eq('tenant_id', tenant.id)
        .single();

      if (!property) continue;

      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('ownerrez_booking_id', booking.id)
        .eq('tenant_id', tenant.id)
        .single();

      const bookingData = {
        ownerrez_booking_id: booking.id,
        tenant_id: tenant.id,
        property_id: property.id,
        arrival: booking.arrival,
        departure: booking.departure,
        guest_name: booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Unknown',
        guest_email: booking.guest?.email,
        total_amount: booking.total_amount || 0,
        status: booking.status,
        platform: booking.source || 'Direct',
        updated_at: new Date().toISOString()
      };

      if (existingBooking) {
        await supabase
          .from('bookings')
          .update(bookingData)
          .eq('id', existingBooking.id);
      } else {
        const { data: newBooking } = await supabase
          .from('bookings')
          .insert(bookingData)
          .select()
          .single();

        if (newBooking && booking.charges) {
          const charges = booking.charges.map((charge: any, index: number) => ({
            booking_id: newBooking.id,
            type: charge.type,
            amount: charge.amount,
            description: charge.description,
            position: index
          }));

          await supabase.from('booking_charges').insert(charges);
        }
      }
    }
  }
}

async function generateMonthlyReports(supabase: any, env: Env) {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true);

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const year = lastMonth.getFullYear();
  const month = lastMonth.getMonth() + 1;

  for (const tenant of tenants || []) {
    await supabase
      .from('generated_reports')
      .insert({
        tenant_id: tenant.id,
        name: `Monthly Report - ${year}/${month}`,
        format: 'monthly_summary',
        metadata: { year, month },
        created_at: new Date().toISOString()
      });
  }
}