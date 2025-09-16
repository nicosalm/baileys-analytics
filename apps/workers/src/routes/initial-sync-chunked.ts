import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { OwnerRezService } from '../services/ownerrez';

const initialSyncChunked = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

initialSyncChunked.use('/*', authMiddleware);

// Check if initial sync is needed
initialSyncChunked.get('/status', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  // First check if sync has been completed
  const { data: completedSync } = await supabase
    .from('sync_status')
    .select('status, last_sync, metadata')
    .eq('tenant_id', tenantId)
    .eq('sync_type', 'initial_sync_completed')
    .single();

  if (completedSync?.status === 'success') {
    return c.json({
      needed: false,
      completed: true,
      lastSync: completedSync.last_sync
    });
  }

  // Check if sync is marked as needed (from manual reset)
  const { data: needsSync } = await supabase
    .from('sync_status')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('sync_type', 'initial_sync_needed')
    .single();

  if (needsSync) {
    return c.json({
      needed: true,
      completed: false
    });
  }

  // Check if OwnerRez is connected but no sync status exists
  const { data: ownerrezToken } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ownerrez')
    .single();

  // Only need sync if connected and never synced before
  return c.json({
    needed: !!ownerrezToken && !completedSync,
    completed: false
  });
});

// Sync properties (step 1)
initialSyncChunked.post('/properties', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  const { data: ownerrezToken } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ownerrez')
    .single();

  if (!ownerrezToken?.access_token) {
    return c.json({ error: 'No OwnerRez connection found' }, 400);
  }

  const ownerRez = new OwnerRezService(ownerrezToken.access_token);
  
  try {
    const properties = await ownerRez.fetchProperties();
    
    for (const property of properties) {
      await supabase
        .from('properties')
        .upsert({
          tenant_id: tenantId,
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
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,ownerrez_id'
        });
    }

    return c.json({
      success: true,
      propertiesCount: properties.length,
      properties: properties.map(p => ({ id: p.id, name: p.name }))
    });
  } catch (error) {
    console.error('Failed to sync properties:', error);
    return c.json({ error: 'Failed to sync properties' }, 500);
  }
});

// Sync bookings for a specific property (step 2 - called multiple times)
initialSyncChunked.post('/bookings/:propertyId', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');
  const ownerrezPropertyId = c.req.param('propertyId');

  const { data: ownerrezToken } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ownerrez')
    .single();

  if (!ownerrezToken?.access_token) {
    return c.json({ error: 'No OwnerRez connection found' }, 400);
  }

  // Get the database property ID
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('ownerrez_id', ownerrezPropertyId)
    .single();

  if (!property) {
    return c.json({ error: 'Property not found' }, 404);
  }

  const ownerRez = new OwnerRezService(ownerrezToken.access_token);
  
  try {
    // Sync 3 years of historical data plus 1 year future
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const bookings = await ownerRez.fetchBookings(
      ownerrezPropertyId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    let bookingsCount = 0;
    let blocksCount = 0;

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 50;
    for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
      const batch = bookings.slice(i, i + BATCH_SIZE);
      
      for (const booking of batch) {
        if (booking.is_block || booking.type === 'block') {
          await supabase
            .from('blocks')
            .upsert({
              ownerrez_block_id: booking.id,
              tenant_id: tenantId,
              property_id: property.id,
              arrival: booking.arrival,
              departure: booking.departure,
              type: booking.type || 'block',
              reason: booking.reason,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'ownerrez_block_id,tenant_id'
            });
          blocksCount++;
        } else {
          const guestName = booking.guest
            ? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
            : booking.guest_name || 'Unknown';

          await supabase
            .from('bookings')
            .upsert({
              tenant_id: tenantId,
              property_id: property.id,
              ownerrez_booking_id: booking.id,
              guest_name: guestName,
              guest_email: booking.guest?.email || booking.guest_email,
              guest_phone: booking.guest?.phone || booking.guest_phone,
              arrival: booking.arrival,
              departure: booking.departure,
              total_amount: booking.total_amount || 0,
              status: booking.status,
              platform: booking.source || booking.listing_site || 'Direct',
              adults: booking.adults || 0,
              children: booking.children || 0,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'tenant_id,ownerrez_booking_id'
            });
          bookingsCount++;
        }
      }
    }

    return c.json({
      success: true,
      bookingsCount,
      blocksCount
    });
  } catch (error) {
    console.error(`Failed to sync bookings for property ${ownerrezPropertyId}:`, error);
    return c.json({ error: 'Failed to sync bookings' }, 500);
  }
});

// Mark sync as complete
initialSyncChunked.post('/complete', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');
  const { totalProperties, totalBookings, totalBlocks } = await c.req.json();

  await supabase
    .from('sync_status')
    .upsert({
      tenant_id: tenantId,
      sync_type: 'initial_sync_completed',
      last_sync: new Date().toISOString(),
      status: 'success',
      records_synced: totalBookings,
      metadata: {
        properties: totalProperties,
        bookings: totalBookings,
        blocks: totalBlocks,
        completedAt: new Date().toISOString()
      }
    }, {
      onConflict: 'tenant_id,sync_type'
    });

  return c.json({ success: true });
});

// Reset sync status to allow manual re-sync
initialSyncChunked.post('/reset', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  // Delete the completed sync status to allow re-sync
  await supabase
    .from('sync_status')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('sync_type', 'initial_sync_completed');

  // Mark that initial sync is needed again
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

  return c.json({ success: true });
});

export { initialSyncChunked };