import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { OwnerRezService } from '../services/ownerrez';

const initialSync = new Hono<{ Bindings: Env; Variables: { user: any } }>();

initialSync.use('/*', authMiddleware);

initialSync.post('/full', async (c) => {
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

  const { data: ownerrezToken } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('tenant_id', tenant.id)
    .eq('provider', 'ownerrez')
    .single();

  if (!ownerrezToken?.access_token) {
    return c.json({
      error: 'No OwnerRez connection found. Please connect to OwnerRez first.',
      requiresAuth: true
    }, 400);
  }

  const ownerRez = new OwnerRezService(ownerrezToken.access_token);

  try {
    const properties = await ownerRez.fetchProperties();

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

      if (error) {
        console.error('Failed to upsert property in initial sync:', error);
      }
    }

    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    let totalBookings = 0;
    let totalGuests = new Set();
    let totalBlocks = 0;

    for (const property of properties) {
      try {
        const { data: dbProperty } = await supabase
          .from('properties')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('ownerrez_id', property.id)
          .single();

        if (!dbProperty) {
          console.error(`Property not found in database for OwnerRez ID ${property.id}`);
          continue;
        }

        const bookings = await ownerRez.fetchBookings(
          property.id,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );

        for (const booking of bookings) {
          if (booking.is_block || booking.type === 'block') {
            await supabase
                  .from('blocks')
                  .upsert({
                    ownerrez_block_id: booking.id,
                    tenant_id: tenant.id,
                    property_id: dbProperty.id,  // use the correct uuid
                    arrival: booking.arrival,
                    departure: booking.departure,
                    type: booking.type || 'block',
                    reason: booking.reason,
                    updated_at: new Date().toISOString()
                  })
                  .eq('ownerrez_block_id', booking.id)
                  .eq('tenant_id', tenant.id);
                totalBlocks++;
                continue;
              }

              const guestName = booking.guest
                ? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
                : booking.guest_name || 'Unknown';

              if (guestName && guestName !== 'Unknown') {
                totalGuests.add(guestName.toLowerCase());
              }

              const { error } = await supabase
                .from('bookings')
                .upsert({
                  tenant_id: tenant.id,
                  property_id: dbProperty.id,  // use the correct uuid
                  ownerrez_booking_id: booking.id,
                  guest_name: guestName,
                  guest_email: booking.guest?.email || booking.guest_email,
                  guest_phone: booking.guest?.phone || booking.guest_phone,
                  arrival: booking.arrival,
                  departure: booking.departure,
                  total_amount: booking.total_amount || 0,
                  status: booking.status,
                  platform: booking.source || booking.listing_site || 'Direct',
                  platform_reservation_number: booking.custom_source_id || booking.external_id,
                  adults: booking.adults || 0,
                  children: booking.children || 0,
                  infants: booking.infants || 0,
                  pets: booking.pets || 0,
                  booked_utc: booking.booked_date || booking.created_date,
                  canceled_utc: booking.status === 'canceled' ? booking.modified_date : null,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'tenant_id,ownerrez_booking_id',
                  ignoreDuplicates: false
                });

              if (error) {
                console.error('Failed to upsert booking:', error);
              }

              if (booking.charges && booking.charges.length > 0) {
                const { data: savedBooking } = await supabase
                  .from('bookings')
                  .select('id')
                  .eq('ownerrez_booking_id', booking.id)
                  .eq('tenant_id', tenant.id)
                  .single();

                if (savedBooking) {
                  await supabase
                    .from('booking_charges')
                    .delete()
                    .eq('booking_id', savedBooking.id);

                  const charges = booking.charges.map((charge: any, index: number) => ({
                    booking_id: savedBooking.id,
                    type: charge.type,
                    amount: charge.amount,
                    description: charge.description,
                    position: index
                  }));

                  if (charges.length > 0) {
                    await supabase.from('booking_charges').insert(charges);
                  }
                }
              }

          totalBookings++;
        }
      } catch (error) {
        console.error(`Failed to sync bookings for property ${property.id}:`, error);
      }
    }

    await supabase
      .from('sync_status')
      .upsert({
        tenant_id: tenant.id,
        sync_type: 'full_sync',
        last_sync: new Date().toISOString(),
        status: 'success',
        records_synced: totalBookings,
        metadata: {
          properties: properties.length,
          bookings: totalBookings,
          blocks: totalBlocks,
          unique_guests: totalGuests.size,
          date_range: '2 years back, 1 year forward'
        }
      })
      .eq('tenant_id', tenant.id)
      .eq('sync_type', 'full_sync');

    return c.json({
      success: true,
      summary: {
        propertiesSynced: properties.length,
        bookingsSynced: totalBookings,
        blocksSynced: totalBlocks,
        uniqueGuests: totalGuests.size,
        message: 'Sync complete. Webhooks will handle future updates automatically.'
      }
    });

  } catch (error: any) {
    await supabase
      .from('sync_status')
      .upsert({
        tenant_id: tenant.id,
        sync_type: 'full_sync',
        last_sync: new Date().toISOString(),
        status: 'error',
        error_message: error.message
      })
      .eq('tenant_id', tenant.id)
      .eq('sync_type', 'full_sync');

    return c.json({ error: error.message }, 500);
  }
});

export { initialSync };
