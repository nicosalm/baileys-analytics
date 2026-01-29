import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { OwnerRezService } from '../services/ownerrez';
import { getValidOwnerRezToken } from '../services/ownerrez-token';
import { normalizeBookingStatus, SUPABASE_MAX_ROWS } from '../constants';

const initialSyncChunked = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

initialSyncChunked.use('/*', authMiddleware);

// check if initial sync is needed
initialSyncChunked.get('/status', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

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

  const { data: ownerrezToken } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ownerrez')
    .single();

  // only need sync if connected and never synced before
  return c.json({
    needed: !!ownerrezToken && !completedSync,
    completed: false
  });
});

// sync properties (step 1)
initialSyncChunked.post('/properties', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
  if (tokenResult.error) {
    return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
  }

  const ownerRez = new OwnerRezService(tokenResult.accessToken);

  try {
    const properties = await ownerRez.fetchProperties();

    for (const property of properties) {
      const { data: upsertedProperty, error: propertyError } = await supabase
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
        })
        .select()
        .single();

      if (propertyError) {
        console.error(`Failed to upsert property ${property.id}:`, propertyError);
        continue; // skip to next property
      }

      if (property.tags && Array.isArray(property.tags) && upsertedProperty) {
        try {
          for (const tag of property.tags) {
            // tags come as strings from OwnerRez API
            const tagName = typeof tag === 'string' ? tag : (tag.name || tag);

            const { data: existingTags } = await supabase
              .from('tags')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('name', tagName);

            let tagId = existingTags && existingTags.length > 0 ? existingTags[0].id : null;

            if (!tagId) {
              const { data: newTag, error: tagError } = await supabase
                .from('tags')
                .insert({
                  tenant_id: tenantId,
                  name: tagName,
                  color: typeof tag === 'object' ? (tag.color || null) : null
                })
                .select()
                .single();

              if (tagError) {
                console.error(`Failed to create tag ${tag.name || tag}:`, tagError);
                continue;
              }
              tagId = newTag?.id;
            }

            if (tagId) {
              const { error: linkError } = await supabase
                .from('property_tags')
                .upsert({
                  property_id: upsertedProperty.id,
                  tag_id: tagId
                }, {
                  onConflict: 'property_id,tag_id'
                });

              if (linkError) {
                console.error(`Failed to link property to tag:`, linkError);
              }
            }
          }
        } catch (tagError) {
          console.error(`Failed to sync tags for property ${property.id}:`, tagError);
        }
      }
    }

    return c.json({
      success: true,
      propertiesCount: properties.length,
      properties: properties.map(p => ({ id: p.id, name: p.name }))
    });
  } catch (error) {
    console.error('Failed to sync properties:', error);
    const rawMessage = error instanceof Error ? error.message : '';
    if (rawMessage.includes('Unauthorized') || rawMessage.includes('Forbidden')) {
      return c.json({
        error: 'OwnerRez rejected the request. Please reconnect to OwnerRez in Settings.',
        requiresAuth: true
      }, 400);
    }
    return c.json({ error: 'Failed to sync properties' }, 500);
  }
});

// sync bookings for a specific property (step 2 - called multiple times)
initialSyncChunked.post('/bookings/:propertyId', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');
  const ownerrezPropertyId = c.req.param('propertyId');

  const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
  if (tokenResult.error) {
    return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('ownerrez_id', ownerrezPropertyId)
    .single();

  if (!property) {
    return c.json({ error: 'Property not found' }, 404);
  }

  const ownerRez = new OwnerRezService(tokenResult.accessToken);

  try {
    // sync 3 years of historical data plus 1 year future
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const bookings = await ownerRez.fetchBookings(
      ownerrezPropertyId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Collect all data in memory first, then batch upsert to avoid
    // hitting the Cloudflare Workers 1000 subrequest limit
    const allBlocks: any[] = [];
    const allBookingData: any[] = [];
    const allTagNames = new Set<string>();
    // Map ownerrez_booking_id -> tag names for linking after upsert
    const bookingTagMap = new Map<number, string[]>();

    for (const booking of bookings) {
      if (booking.is_block || booking.type === 'block') {
        allBlocks.push({
          ownerrez_block_id: booking.id,
          tenant_id: tenantId,
          property_id: parseInt(ownerrezPropertyId),
          arrival: booking.arrival,
          departure: booking.departure,
          type: booking.type || 'block',
          reason: booking.reason,
          updated_at: new Date().toISOString()
        });
      } else {
        const guestName = booking.guest
          ? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
          : booking.guest_name || 'Unknown';

        const guestEmail = booking.guest?.email_addresses?.find((e: any) => e.is_default)?.address ||
                          booking.guest?.email_addresses?.[0]?.address ||
                          booking.guest?.email ||
                          booking.guest_email;

        const guestPhone = booking.guest?.phones?.find((p: any) => p.is_default)?.number ||
                          booking.guest?.phones?.[0]?.number ||
                          booking.guest?.phone ||
                          booking.guest_phone;

        allBookingData.push({
          tenant_id: tenantId,
          property_id: property.id,
          ownerrez_booking_id: booking.id,
          ownerrez_guest_id: booking.guest?.id?.toString(),
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          arrival: booking.arrival,
          departure: booking.departure,
          total_amount: booking.total_amount || 0,
          status: normalizeBookingStatus(booking.status),
          platform: booking.source || booking.listing_site || 'Direct',
          adults: booking.adults || 0,
          children: booking.children || 0,
          updated_at: new Date().toISOString()
        });

        // Collect tags for batch processing
        if (booking.tags && Array.isArray(booking.tags)) {
          const tagNames = booking.tags.map((t: any) => typeof t === 'string' ? t : (t.name || t));
          tagNames.forEach((n: string) => allTagNames.add(n));
          bookingTagMap.set(booking.id, tagNames);
        }
      }
    }

    // Batch upsert blocks in chunks of 100
    const CHUNK_SIZE = 100;
    for (let i = 0; i < allBlocks.length; i += CHUNK_SIZE) {
      const chunk = allBlocks.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('blocks')
        .upsert(chunk, { onConflict: 'ownerrez_block_id,tenant_id' });
      if (error) {
        console.error(`Failed to batch upsert blocks chunk ${i}:`, error);
      }
    }

    // Batch upsert bookings in chunks of 100
    for (let i = 0; i < allBookingData.length; i += CHUNK_SIZE) {
      const chunk = allBookingData.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('bookings')
        .upsert(chunk, { onConflict: 'tenant_id,ownerrez_booking_id' });
      if (error) {
        console.error(`Failed to batch upsert bookings chunk ${i}:`, error);
      }
    }

    // Batch ensure all tags exist (1 fetch + 1 insert instead of N per tag)
    if (allTagNames.size > 0) {
      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('tenant_id', tenantId);

      const existingTagMap = new Map((existingTags || []).map((t: any) => [t.name, t.id]));
      const missingTags = [...allTagNames].filter(name => !existingTagMap.has(name));

      if (missingTags.length > 0) {
        const { data: newTags } = await supabase
          .from('tags')
          .upsert(
            missingTags.map(name => ({ tenant_id: tenantId, name })),
            { onConflict: 'tenant_id,name' }
          )
          .select('id, name');

        if (newTags) {
          for (const t of newTags) {
            existingTagMap.set(t.name, t.id);
          }
        }
      }

      // Now link bookings to tags — need booking UUIDs from DB
      if (bookingTagMap.size > 0) {
        const ownerrezIds = [...bookingTagMap.keys()];
        const { data: dbBookings } = await supabase
          .from('bookings')
          .select('id, ownerrez_booking_id')
          .eq('tenant_id', tenantId)
          .in('ownerrez_booking_id', ownerrezIds);

        if (dbBookings) {
          const allLinks: any[] = [];
          for (const dbBooking of dbBookings) {
            const tagNames = bookingTagMap.get(Number(dbBooking.ownerrez_booking_id));
            if (tagNames) {
              for (const tagName of tagNames) {
                const tagId = existingTagMap.get(tagName);
                if (tagId) {
                  allLinks.push({ booking_id: dbBooking.id, tag_id: tagId });
                }
              }
            }
          }

          // Batch upsert booking_tags in chunks
          for (let i = 0; i < allLinks.length; i += CHUNK_SIZE) {
            const chunk = allLinks.slice(i, i + CHUNK_SIZE);
            await supabase
              .from('booking_tags')
              .upsert(chunk, { onConflict: 'booking_id,tag_id' });
          }
        }
      }
    }

    return c.json({
      success: true,
      bookingsCount: allBookingData.length,
      blocksCount: allBlocks.length,
      totalFromApi: bookings.length
    });
  } catch (error) {
    console.error(`Failed to sync bookings for property ${ownerrezPropertyId}:`, error);
    return c.json({ error: 'Failed to sync bookings' }, 500);
  }
});

// sync all guests (step 3)
initialSyncChunked.post('/guests', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
  if (tokenResult.error) {
    return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
  }

  const ownerRez = new OwnerRezService(tokenResult.accessToken);

  try {
    const guests = await ownerRez.fetchAllGuests();
    let guestsCount = 0;

    for (const guest of guests) {
      const fullName = `${guest.first_name || ''} ${guest.last_name || ''}`.trim();
      const email = guest.email_addresses?.find((e: any) => e.is_default)?.address ||
                   guest.email_addresses?.[0]?.address;
      const phone = guest.phones?.find((p: any) => p.is_default)?.number ||
                   guest.phones?.[0]?.number;

      const { data: upsertedGuest } = await supabase
        .from('guests')
        .upsert({
          ownerrez_guest_id: guest.id?.toString(),
          tenant_id: tenantId,
          first_name: guest.first_name,
          last_name: guest.last_name,
          full_name: fullName,
          email: email,
          phone: phone,
          data: guest,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,ownerrez_guest_id'
        })
        .select()
        .single();

      if (guest.tags && Array.isArray(guest.tags) && upsertedGuest) {
        await supabase
          .from('guest_tags')
          .delete()
          .eq('guest_id', upsertedGuest.id);

        for (const tag of guest.tags) {
          // tags come as strings from OwnerRez API
          const tagName = typeof tag === 'string' ? tag : (tag.name || tag);

          const { data: existingTags } = await supabase
            .from('tags')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('name', tagName);

          let tagId = existingTags && existingTags.length > 0 ? existingTags[0].id : null;

          if (!tagId) {
            const { data: newTag } = await supabase
              .from('tags')
              .insert({
                tenant_id: tenantId,
                name: tagName,
                color: typeof tag === 'object' ? (tag.color || null) : null
              })
              .select()
              .single();
            tagId = newTag?.id;
          }

          if (tagId) {
            await supabase
              .from('guest_tags')
              .insert({
                guest_id: upsertedGuest.id,
                tag_id: tagId
              });
          }
        }
      }
      guestsCount++;
    }

    // after syncing all guests, update bookings with guest email/phone
    // console.log('Updating bookings with guest contact information...');

    // first: match by ownerrez_guest_id (most reliable)
    const { data: bookingsById } = await supabase
      .from('bookings')
      .select('id, ownerrez_guest_id')
      .eq('tenant_id', tenantId)
      .is('guest_email', null)
      .not('ownerrez_guest_id', 'is', null)
      .limit(SUPABASE_MAX_ROWS);

    if (bookingsById && bookingsById.length > 0) {
      for (const booking of bookingsById) {
        const { data: guest } = await supabase
          .from('guests')
          .select('email, phone')
          .eq('tenant_id', tenantId)
          .eq('ownerrez_guest_id', booking.ownerrez_guest_id)
          .single();

        if (guest?.email || guest?.phone) {
          await supabase
            .from('bookings')
            .update({
              guest_email: guest.email,
              guest_phone: guest.phone
            })
            .eq('id', booking.id);
        }
      }
    }

    // second: fall back to case-insensitive name matching for bookings without ownerrez_guest_id
    const { data: bookingsByName } = await supabase
      .from('bookings')
      .select('id, guest_name')
      .eq('tenant_id', tenantId)
      .is('guest_email', null)
      .is('ownerrez_guest_id', null)
      .not('guest_name', 'is', null)
      .limit(SUPABASE_MAX_ROWS);

    if (bookingsByName && bookingsByName.length > 0) {
      // console.log(`Found ${bookingsByName.length} bookings to update via name matching`);

      for (const booking of bookingsByName) {
        const { data: matchingGuests } = await supabase
          .from('guests')
          .select('email, phone')
          .eq('tenant_id', tenantId)
          .ilike('full_name', booking.guest_name)
          .limit(1);

        if (matchingGuests && matchingGuests.length > 0 && (matchingGuests[0].email || matchingGuests[0].phone)) {
          await supabase
            .from('bookings')
            .update({
              guest_email: matchingGuests[0].email,
              guest_phone: matchingGuests[0].phone
            })
            .eq('id', booking.id);
        }
      }
    }

    // also update bookings that have guest_email but no guest_phone
    const { data: bookingsWithEmail } = await supabase
      .from('bookings')
      .select('id, guest_email')
      .eq('tenant_id', tenantId)
      .not('guest_email', 'is', null)
      .is('guest_phone', null)
      .limit(SUPABASE_MAX_ROWS);

    if (bookingsWithEmail && bookingsWithEmail.length > 0) {
      for (const booking of bookingsWithEmail) {
        const { data: matchingGuests } = await supabase
          .from('guests')
          .select('phone')
          .eq('tenant_id', tenantId)
          .eq('email', booking.guest_email)
          .limit(1);

        if (matchingGuests && matchingGuests.length > 0 && matchingGuests[0].phone) {
          await supabase
            .from('bookings')
            .update({ guest_phone: matchingGuests[0].phone })
            .eq('id', booking.id);
        }
      }
    }

    return c.json({
      success: true,
      guestsCount
    });
  } catch (error) {
    console.error('Failed to sync guests:', error);
    return c.json({ error: 'Failed to sync guests' }, 500);
  }
});

// mark sync as complete
initialSyncChunked.post('/complete', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');
  const { totalProperties, totalBookings, totalBlocks, totalGuests } = await c.req.json();

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
        guests: totalGuests || 0,
        completedAt: new Date().toISOString()
      }
    }, {
      onConflict: 'tenant_id,sync_type'
    });

  return c.json({ success: true });
});

// reset sync status to allow manual re-sync
initialSyncChunked.post('/reset', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  // delete the completed sync status to allow re-sync
  await supabase
    .from('sync_status')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('sync_type', 'initial_sync_completed');

  // mark that initial sync is needed again
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
