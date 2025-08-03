import { query, transaction } from './database';

type OwnerRezTag = {
  id: number;
  name: string;
  color?: string;
}

type TagMapping = Map<string, string>; // ownerrez_id -> tag_id

// Get or create tags and return mapping
export async function ensureTags(
  tags: OwnerRezTag[],
  tenantId: string,
  type: 'property' | 'booking' | 'guest' | 'payment'
): Promise<TagMapping> {
  const mapping = new Map<string, string>();

  for (const tag of tags) {
    if (!tag || typeof tag.id !== 'number' || !tag.name) {
      console.warn(`Skipping invalid tag:`, tag);
      continue;
    }

    const result = await query<{ id: string }>(
      `INSERT INTO tags (tenant_id, ownerrez_id, name, type, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, ownerrez_id) DO UPDATE
       SET name = EXCLUDED.name,
           color = EXCLUDED.color,
           updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [tenantId, tag.id.toString(), tag.name, type, tag.color || null]
    );

    if (result.success && result.data.length > 0) {
      mapping.set(tag.id.toString(), result.data[0].id);
    }
  }

  return mapping;
}


// Sync tags for a property
export async function syncPropertyTags(
  propertyId: string,
  ownerrezTags: OwnerRezTag[],
  tenantId: string
): Promise<void> {
  if (!ownerrezTags || ownerrezTags.length === 0) {
    // Clear existing tags
    await query('DELETE FROM property_tags WHERE property_id = $1', [propertyId]);
    return;
  }

  const tagMapping = await ensureTags(ownerrezTags, tenantId, 'property');

  await transaction(async (client) => {
    // Clear existing tags
    await client.query('DELETE FROM property_tags WHERE property_id = $1', [propertyId]);

    // Add new tags
    for (const tagId of tagMapping.values()) {
      await client.query(
        'INSERT INTO property_tags (property_id, tag_id) VALUES ($1, $2)',
        [propertyId, tagId]
      );
    }
  });
}

// Sync tags for a booking
export async function syncBookingTags(
  bookingId: string,
  ownerrezTags: OwnerRezTag[],
  tenantId: string
): Promise<void> {
  if (!ownerrezTags || ownerrezTags.length === 0) {
    // Clear existing tags
    await query('DELETE FROM booking_tags WHERE booking_id = $1', [bookingId]);
    return;
  }

  const tagMapping = await ensureTags(ownerrezTags, tenantId, 'booking');

  await transaction(async (client) => {
    // Clear existing tags
    await client.query('DELETE FROM booking_tags WHERE booking_id = $1', [bookingId]);

    // Add new tags
    for (const tagId of tagMapping.values()) {
      await client.query(
        'INSERT INTO booking_tags (booking_id, tag_id) VALUES ($1, $2)',
        [bookingId, tagId]
      );
    }
  });
}

// Helper to infer tag type from tag name patterns
export function inferTagType(tagName: string): 'property' | 'booking' | 'payment' | 'guest' {
  const name = tagName.toLowerCase();

  // Payment method patterns
  if (name.includes('ach') || name.includes('zelle') || name.includes('paypal') ||
      name.includes('venmo') || name.includes('wire') || name.includes('check') ||
      name.includes('credit') || name.includes('debit')) {
    return 'payment';
  }

  // Property feature patterns
  if (name.includes('beachfront') || name.includes('pool') || name.includes('hot tub') ||
      name.includes('pet') || name.includes('wifi') || name.includes('parking')) {
    return 'property';
  }

  // Guest patterns
  if (name.includes('repeat') || name.includes('vip') || name.includes('guest')) {
    return 'guest';
  }

  // Default to booking
  return 'booking';
}
