import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { OwnerRezService } from '../services/ownerrez';
import { getValidOwnerRezToken } from '../services/ownerrez-token';
import { normalizeBookingStatus, estimateGuestListingSiteFee } from '../constants';

const sync = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

sync.use('/*', authMiddleware);

// check if initial sync is needed
sync.get('/status', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  const { data: completedSync } = await supabase
    .from('sync_status')
    .select('status, last_sync')
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
sync.post('/properties', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
  if (tokenResult.error) {
    return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
  }

  const ownerRez = new OwnerRezService(tokenResult.accessToken, c.env.CACHE);

  try {
    const properties = await ownerRez.fetchProperties();

    // Batch upsert all properties at once
    const propertyData = properties.map(property => ({
      tenant_id: tenantId,
      ownerrez_id: property.id,
      name: property.name,
      internal_code: property.internal_code || null,
      address: property.address?.street1 || property.address,
      city: property.address?.city,
      state: property.address?.state,
      postal_code: property.address?.postal_code,
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      max_guests: property.max_guests || 0,
      active: property.active !== false,
      updated_at: new Date().toISOString()
    }));

    const { error: propertyError } = await supabase
      .from('properties')
      .upsert(propertyData, { onConflict: 'tenant_id,ownerrez_id' });

    if (propertyError) {
      console.error('Failed to batch upsert properties:', propertyError);
      return c.json({ error: 'Failed to save properties' }, 500);
    }

    // Fetch back property IDs for tag linking
    const { data: upsertedProperties } = await supabase
      .from('properties')
      .select('id, ownerrez_id')
      .eq('tenant_id', tenantId);

    const propertyIdMap = new Map(
      (upsertedProperties || []).map((p: any) => [String(p.ownerrez_id), p.id])
    );

    // Collect all tags from properties, then batch process
    const allTagNames = new Set<string>();
    const propertyTagMap = new Map<string, string[]>();

    for (const property of properties) {
      if (property.tags && Array.isArray(property.tags)) {
        const tagNames = property.tags.map((t: any) => typeof t === 'string' ? t : (t.name || t));
        tagNames.forEach((n: string) => allTagNames.add(n));
        propertyTagMap.set(String(property.id), tagNames);
      }
    }

    if (allTagNames.size > 0) {
      // Ensure all tags exist
      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('tenant_id', tenantId);

      const tagIdMap = new Map((existingTags || []).map((t: any) => [t.name, t.id]));
      const missingTags = [...allTagNames].filter(name => !tagIdMap.has(name));

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
            tagIdMap.set(t.name, t.id);
          }
        }
      }

      // Batch link properties to tags
      const allLinks: any[] = [];
      for (const [ownerrezId, tagNames] of propertyTagMap) {
        const propertyId = propertyIdMap.get(ownerrezId);
        if (!propertyId) continue;
        for (const tagName of tagNames) {
          const tagId = tagIdMap.get(tagName);
          if (tagId) {
            allLinks.push({ property_id: propertyId, tag_id: tagId });
          }
        }
      }

      const CHUNK_SIZE = 100;
      for (let i = 0; i < allLinks.length; i += CHUNK_SIZE) {
        const chunk = allLinks.slice(i, i + CHUNK_SIZE);
        await supabase
          .from('property_tags')
          .upsert(chunk, { onConflict: 'property_id,tag_id' });
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

// sync all bookings across all properties in one batch (step 2)
sync.post('/bookings', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
  if (tokenResult.error) {
    return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
  }

  // build ownerrez_id -> db uuid mapping for all tenant properties
  const { data: dbProperties } = await supabase
    .from('properties')
    .select('id, ownerrez_id')
    .eq('tenant_id', tenantId);

  if (!dbProperties || dbProperties.length === 0) {
    return c.json({ error: 'No properties found — run properties sync first' }, 400);
  }

  const propertyUuidMap = new Map<string, string>();
  const ownerrezPropertyIds: string[] = [];
  for (const p of dbProperties) {
    propertyUuidMap.set(String(p.ownerrez_id), p.id);
    ownerrezPropertyIds.push(String(p.ownerrez_id));
  }

  const ownerRez = new OwnerRezService(tokenResult.accessToken, c.env.CACHE);

  try {
    // sync 4 years of historical data plus 1 year future
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 4);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    // single API call with all property IDs comma-separated
    const bookings = await ownerRez.fetchBookings(
      ownerrezPropertyIds,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const allBlocks: any[] = [];
    const allBookingData: any[] = [];
    const allTagNames = new Set<string>();
    const bookingTagMap = new Map<number, string[]>();
    const bookingChargesMap = new Map<number, any[]>();

    for (const booking of bookings) {
      const orPropertyId = String(booking.property_id);

      if (booking.is_block || booking.type === 'block') {
        allBlocks.push({
          ownerrez_block_id: booking.id,
          tenant_id: tenantId,
          property_id: booking.property_id,
          arrival: booking.arrival,
          departure: booking.departure,
          type: booking.type || 'block',
          reason: booking.reason,
          updated_at: new Date().toISOString()
        });
      } else {
        const dbPropertyId = propertyUuidMap.get(orPropertyId);
        if (!dbPropertyId) continue; // skip if property mapping missing

        const guestName = booking.guest
          ? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
          : booking.guest_name || 'Unknown';

        // guest contact info lives in the guests table — not denormalized here
        const platform = booking.source || booking.listing_site || 'Unassigned';
        allBookingData.push({
          tenant_id: tenantId,
          property_id: dbPropertyId,
          ownerrez_booking_id: booking.id,
          ownerrez_guest_id: booking.guest?.id?.toString(),
          guest_name: guestName,
          arrival: booking.arrival,
          departure: booking.departure,
          total_amount: booking.total_amount || 0,
          guest_listing_site_fee: estimateGuestListingSiteFee(platform, booking.total_amount || 0, booking.booked_utc || booking.created_utc),
          host_service_fee: booking.total_host_fees || 0,
          status: normalizeBookingStatus(booking.status),
          platform,
          adults: booking.adults || 0,
          children: booking.children || 0,
          booked_utc: booking.booked_utc || booking.created_utc,
          updated_at: new Date().toISOString()
        });

        if (booking.charges && Array.isArray(booking.charges) && booking.charges.length > 0) {
          bookingChargesMap.set(booking.id, booking.charges);
        }

        if (booking.tags && Array.isArray(booking.tags)) {
          const tagNames = booking.tags.map((t: any) => typeof t === 'string' ? t : (t.name || t));
          tagNames.forEach((n: string) => allTagNames.add(n));
          bookingTagMap.set(booking.id, tagNames);
        }
      }
    }

    // batch upsert blocks
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

    // create stub guest records for any ownerrez_guest_id referenced by bookings
    // (the FK constraint requires the guest to exist before the booking)
    const guestStubs = new Map<string, { ownerrez_guest_id: string; tenant_id: string; full_name: string; updated_at: string }>();
    for (const b of allBookingData) {
      if (b.ownerrez_guest_id && !guestStubs.has(b.ownerrez_guest_id)) {
        guestStubs.set(b.ownerrez_guest_id, {
          ownerrez_guest_id: b.ownerrez_guest_id,
          tenant_id: tenantId,
          full_name: b.guest_name,
          updated_at: new Date().toISOString()
        });
      }
    }
    if (guestStubs.size > 0) {
      const stubs = Array.from(guestStubs.values());
      for (let i = 0; i < stubs.length; i += CHUNK_SIZE) {
        const chunk = stubs.slice(i, i + CHUNK_SIZE);
        await supabase
          .from('guests')
          .upsert(chunk, { onConflict: 'tenant_id,ownerrez_guest_id', ignoreDuplicates: true });
      }
    }

    // batch upsert bookings
    for (let i = 0; i < allBookingData.length; i += CHUNK_SIZE) {
      const chunk = allBookingData.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('bookings')
        .upsert(chunk, { onConflict: 'tenant_id,ownerrez_booking_id' });
      if (error) {
        console.error(`Failed to batch upsert bookings chunk ${i}:`, error);
      }
    }

    // upsert charges
    if (bookingChargesMap.size > 0) {
      const chargeOwnerrezIds = [...bookingChargesMap.keys()].map(String);
      const { data: dbBookingsForCharges } = await supabase
        .from('bookings')
        .select('id, ownerrez_booking_id')
        .eq('tenant_id', tenantId)
        .in('ownerrez_booking_id', chargeOwnerrezIds);

      if (dbBookingsForCharges) {
        const allCharges: any[] = [];
        const staleDeletes: any[] = [];

        for (const dbBooking of dbBookingsForCharges) {
          const charges = bookingChargesMap.get(Number(dbBooking.ownerrez_booking_id));
          if (!charges) continue;
          for (let i = 0; i < charges.length; i++) {
            allCharges.push({
              booking_id: dbBooking.id,
              type: charges[i].type,
              amount: charges[i].amount,
              description: charges[i].description,
              is_taxable: charges[i].is_taxable ?? false,
              position: i
            });
          }
          staleDeletes.push(
            supabase.from('booking_charges')
              .delete()
              .eq('booking_id', dbBooking.id)
              .gte('position', charges.length)
          );
        }

        for (let i = 0; i < allCharges.length; i += CHUNK_SIZE) {
          const chunk = allCharges.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('booking_charges').upsert(chunk, {
            onConflict: 'booking_id,position',
            ignoreDuplicates: false
          });
          if (error) {
            console.error(`Failed to upsert charges chunk ${i}:`, error);
          }
        }
        await Promise.all(staleDeletes);
      }
    }

    // batch ensure all tags exist and link (before re-enrichment to avoid subrequest limit)
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

          for (let i = 0; i < allLinks.length; i += CHUNK_SIZE) {
            const chunk = allLinks.slice(i, i + CHUNK_SIZE);
            await supabase
              .from('booking_tags')
              .upsert(chunk, { onConflict: 'booking_id,tag_id' });
          }
        }
      }
    }

    // guest contact info lives in the guests table — no re-enrichment needed

    return c.json({
      success: true,
      bookingsCount: allBookingData.length,
      blocksCount: allBlocks.length,
      totalFromApi: bookings.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to sync bookings:', message, error);
    return c.json({ error: `Failed to sync bookings: ${message}` }, 500);
  }
});

// sync all guests (step 3)
sync.post('/guests', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
  if (tokenResult.error) {
    return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
  }

  const ownerRez = new OwnerRezService(tokenResult.accessToken, c.env.CACHE);

  try {
    const guests = await ownerRez.fetchAllGuests();
    const CHUNK_SIZE = 500;

    // Collect all guest data and tags in memory first
    const allGuestData: any[] = [];
    const allTagNames = new Set<string>();
    // Map ownerrez_guest_id -> tag names for linking after upsert
    const guestTagMap = new Map<string, string[]>();

    for (const guest of guests) {
      const fullName = `${guest.first_name || ''} ${guest.last_name || ''}`.trim();
      const email = guest.email_addresses?.find((e: any) => e.is_default)?.address ||
                   guest.email_addresses?.[0]?.address;
      const phone = guest.phones?.find((p: any) => p.is_default)?.number ||
                   guest.phones?.[0]?.number;
      const guestIdStr = guest.id?.toString();

      allGuestData.push({
        ownerrez_guest_id: guestIdStr,
        tenant_id: tenantId,
        first_name: guest.first_name,
        last_name: guest.last_name,
        full_name: fullName,
        email: email,
        phone: phone,
        data: guest,
        updated_at: new Date().toISOString()
      });

      if (guest.tags && Array.isArray(guest.tags) && guestIdStr) {
        const tagNames = guest.tags.map((t: any) => typeof t === 'string' ? t : (t.name || t));
        tagNames.forEach((n: string) => allTagNames.add(n));
        guestTagMap.set(guestIdStr, tagNames);
      }
    }

    // Batch upsert guests in chunks
    for (let i = 0; i < allGuestData.length; i += CHUNK_SIZE) {
      const chunk = allGuestData.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('guests')
        .upsert(chunk, { onConflict: 'tenant_id,ownerrez_guest_id' });
      if (error) {
        console.error(`Failed to batch upsert guests chunk ${i}:`, error);
      }
    }

    // Batch ensure all tags exist and link to guests
    if (allTagNames.size > 0 && guestTagMap.size > 0) {
      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('tenant_id', tenantId);

      const tagIdMap = new Map((existingTags || []).map((t: any) => [t.name, t.id]));
      const missingTags = [...allTagNames].filter(name => !tagIdMap.has(name));

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
            tagIdMap.set(t.name, t.id);
          }
        }
      }

      // Fetch guest UUIDs for tag linking
      const ownerrezGuestIds = [...guestTagMap.keys()];
      const { data: dbGuests } = await supabase
        .from('guests')
        .select('id, ownerrez_guest_id')
        .eq('tenant_id', tenantId)
        .in('ownerrez_guest_id', ownerrezGuestIds);

      if (dbGuests) {
        const allLinks: any[] = [];
        for (const dbGuest of dbGuests) {
          const tagNames = guestTagMap.get(dbGuest.ownerrez_guest_id);
          if (tagNames) {
            for (const tagName of tagNames) {
              const tagId = tagIdMap.get(tagName);
              if (tagId) {
                allLinks.push({ guest_id: dbGuest.id, tag_id: tagId });
              }
            }
          }
        }

        for (let i = 0; i < allLinks.length; i += CHUNK_SIZE) {
          const chunk = allLinks.slice(i, i + CHUNK_SIZE);
          await supabase
            .from('guest_tags')
            .upsert(chunk, { onConflict: 'guest_id,tag_id' });
        }
      }
    }

    return c.json({
      success: true,
      guestsCount: allGuestData.length
    });
  } catch (error) {
    console.error('Failed to sync guests:', error);
    return c.json({ error: 'Failed to sync guests' }, 500);
  }
});

// sync inquiries (step 4 — optional)
sync.post('/inquiries', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');

  try {
    const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
    if (tokenResult.error) {
      return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
    }

    const ownerRez = new OwnerRezService(tokenResult.accessToken, c.env.CACHE);
    // fetch last 2 years of inquiries
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const inquiries = await ownerRez.fetchInquiries(twoYearsAgo.toISOString());

    if (inquiries.length === 0) {
      return c.json({ synced: 0, message: 'No inquiries found' });
    }

    const rows = inquiries.map((inq: Record<string, unknown>) => {
      const guest = inq.guest as Record<string, unknown> | undefined;
      const firstName = guest?.first_name as string | undefined;
      const lastName = guest?.last_name as string | undefined;
      const guestName = [firstName, lastName].filter(Boolean).join(' ') || null;

      return {
        tenant_id: tenantId,
        ownerrez_inquiry_id: inq.id as number,
        property_id: (inq.property_id as number) ?? null,
        guest_name: guestName,
        guest_email: null,
        arrival: (inq.arrival as string) ?? null,
        departure: (inq.departure as string) ?? null,
        status: (inq.type as string) ?? null,
        data: inq,
        created_at: (inq.created_utc as string) ?? (inq.received_utc as string) ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // batch upsert in chunks of 100
    const CHUNK_SIZE = 100;
    let synced = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('inquiries')
        .upsert(chunk, { onConflict: 'ownerrez_inquiry_id,tenant_id' });

      if (error) {
        console.error(`Inquiry sync chunk error at offset ${i}:`, error);
      } else {
        synced += chunk.length;
      }
    }

    return c.json({ synced, total: inquiries.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to sync inquiries:', message, error);
    return c.json({ error: `Failed to sync inquiries: ${message}`, synced: 0 }, 500);
  }
});

// mark sync as complete
sync.post('/complete', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const tenantId = c.get('tenantId');
  const { totalBookings } = await c.req.json();

  await supabase
    .from('sync_status')
    .upsert({
      tenant_id: tenantId,
      sync_type: 'initial_sync_completed',
      last_sync: new Date().toISOString(),
      status: 'success',
      records_synced: totalBookings
    }, {
      onConflict: 'tenant_id,sync_type'
    });

  return c.json({ success: true });
});

// reset sync status to allow manual re-sync
sync.post('/reset', async (c) => {
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

export { sync };
