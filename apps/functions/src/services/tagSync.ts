import { query, transaction, DbResult } from './database';

type OwnerRezTag = {
  id: number
  name: string
  color?: string
}

type TagMapping = ReadonlyMap<string, string>

const createTagRecord = (tag: OwnerRezTag, tenantId: string) => ({
  tenant_id: tenantId,
  ownerrez_id: tag.id.toString(),
  name: tag.name,
  color: tag.color || null
})

// Bulk upsert tags with a single query
const bulkUpsertTags = async (
  tags: readonly OwnerRezTag[],
  tenantId: string
): Promise<DbResult<TagMapping>> => {
  if (tags.length === 0) {
    return { success: true, data: new Map() }
  }

  // Filter out invalid tags
  const validTags = tags.filter(tag =>
    tag && typeof tag.id === 'number' && tag.name
  )

  if (validTags.length === 0) {
    return { success: true, data: new Map() }
  }

  // Build values for bulk insert
  const values: any[] = []
  const placeholders: string[] = []
  let paramIndex = 1

  validTags.forEach(tag => {
    const record = createTagRecord(tag, tenantId)
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`
    )
    values.push(
      record.tenant_id,
      record.ownerrez_id,
      record.name,
      record.color
    )
    paramIndex += 4
  })

  const result = await query<{ id: string; ownerrez_id: string }>(
    `INSERT INTO tags (tenant_id, ownerrez_id, name, color)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (tenant_id, ownerrez_id) DO UPDATE
     SET name = EXCLUDED.name,
         color = EXCLUDED.color,
         updated_at = CURRENT_TIMESTAMP
     RETURNING id, ownerrez_id`,
    values
  )

  if (!result.success) {
    return { success: false, error: 'Failed to bulk upsert tags' }
  }

  // Create mapping from ownerrez_id to internal id
  const mapping = new Map(
    result.data.map(row => [row.ownerrez_id, row.id])
  )

  return { success: true, data: mapping }
}

// Bulk sync entity tags with a single transaction
const bulkSyncEntityTags = async (
  entityId: string,
  ownerrezTags: readonly OwnerRezTag[],
  tenantId: string,
  entityType: 'property' | 'booking'
): Promise<DbResult<void>> => {
  if (!ownerrezTags || ownerrezTags.length === 0) {
    // Just clear all tags for this entity
    const table = entityType === 'property' ? 'property_tags' : 'booking_tags'
    const column = entityType === 'property' ? 'property_id' : 'booking_id'

    const result = await query(
      `DELETE FROM ${table} WHERE ${column} = $1`,
      [entityId]
    )

    return result.success
      ? { success: true, data: undefined }
      : result
  }

  // Ensure tags exist and get mapping
  const tagMappingResult = await bulkUpsertTags(ownerrezTags, tenantId)
  if (!tagMappingResult.success) {
    return tagMappingResult
  }

  const tagMapping = tagMappingResult.data
  const tagIds = Array.from(tagMapping.values())

  if (tagIds.length === 0) {
    return { success: true, data: undefined }
  }

  return transaction(async (client) => {
    const table = entityType === 'property' ? 'property_tags' : 'booking_tags'
    const column = entityType === 'property' ? 'property_id' : 'booking_id'

    // Delete existing tags
    await client.query(
      `DELETE FROM ${table} WHERE ${column} = $1`,
      [entityId]
    )

    // Build bulk insert for entity tags
    const placeholders: string[] = []
    const values: any[] = []
    let paramIndex = 1

    tagIds.forEach(tagId => {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1})`)
      values.push(entityId, tagId)
      paramIndex += 2
    })

    // Insert all tags at once
    await client.query(
      `INSERT INTO ${table} (${column}, tag_id)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  })
}

// Optimized bulk sync for multiple entities at once
export const bulkSyncPropertyTags = async (
  propertyTagsMap: Map<string, OwnerRezTag[]>,
  tenantId: string
): Promise<DbResult<void>> => {
  if (propertyTagsMap.size === 0) {
    return { success: true, data: undefined }
  }

  // Collect all unique tags
  const allTags = new Map<string, OwnerRezTag>()
  for (const tags of propertyTagsMap.values()) {
    for (const tag of tags) {
      if (tag && typeof tag.id === 'number' && tag.name) {
        allTags.set(tag.id.toString(), tag)
      }
    }
  }

  // Bulk upsert all tags at once
  const tagMappingResult = await bulkUpsertTags(Array.from(allTags.values()), tenantId)
  if (!tagMappingResult.success) {
    return tagMappingResult
  }

  const tagMapping = tagMappingResult.data

  return transaction(async (client) => {
    // Delete all existing property tags for these properties
    const propertyIds = Array.from(propertyTagsMap.keys())
    const deletePlaceholders = propertyIds.map((_, i) => `$${i + 1}`).join(', ')

    await client.query(
      `DELETE FROM property_tags WHERE property_id IN (${deletePlaceholders})`,
      propertyIds
    )

    // Build bulk insert for all property-tag relationships
    const values: any[] = []
    const placeholders: string[] = []
    let paramIndex = 1

    for (const [propertyId, tags] of propertyTagsMap.entries()) {
      for (const tag of tags) {
        const tagId = tagMapping.get(tag.id.toString())
        if (tagId) {
          placeholders.push(`($${paramIndex}, $${paramIndex + 1})`)
          values.push(propertyId, tagId)
          paramIndex += 2
        }
      }
    }

    if (placeholders.length > 0) {
      await client.query(
        `INSERT INTO property_tags (property_id, tag_id)
         VALUES ${placeholders.join(', ')}`,
        values
      )
    }
  })
}

// Optimized bulk sync for multiple bookings at once
export const bulkSyncBookingTags = async (
  bookingTagsMap: Map<string, OwnerRezTag[]>,
  tenantId: string
): Promise<DbResult<void>> => {
  if (bookingTagsMap.size === 0) {
    return { success: true, data: undefined }
  }

  // Collect all unique tags
  const allTags = new Map<string, OwnerRezTag>()
  for (const tags of bookingTagsMap.values()) {
    for (const tag of tags) {
      if (tag && typeof tag.id === 'number' && tag.name) {
        allTags.set(tag.id.toString(), tag)
      }
    }
  }

  // Bulk upsert all tags at once
  const tagMappingResult = await bulkUpsertTags(Array.from(allTags.values()), tenantId)
  if (!tagMappingResult.success) {
    return tagMappingResult
  }

  const tagMapping = tagMappingResult.data

  return transaction(async (client) => {
    // Delete all existing booking tags for these bookings
    const bookingIds = Array.from(bookingTagsMap.keys())
    const deletePlaceholders = bookingIds.map((_, i) => `$${i + 1}`).join(', ')

    await client.query(
      `DELETE FROM booking_tags WHERE booking_id IN (${deletePlaceholders})`,
      bookingIds
    )

    // Build bulk insert for all booking-tag relationships
    const values: any[] = []
    const placeholders: string[] = []
    let paramIndex = 1

    for (const [bookingId, tags] of bookingTagsMap.entries()) {
      for (const tag of tags) {
        const tagId = tagMapping.get(tag.id.toString())
        if (tagId) {
          placeholders.push(`($${paramIndex}, $${paramIndex + 1})`)
          values.push(bookingId, tagId)
          paramIndex += 2
        }
      }
    }

    if (placeholders.length > 0) {
      await client.query(
        `INSERT INTO booking_tags (booking_id, tag_id)
         VALUES ${placeholders.join(', ')}`,
        values
      )
    }
  })
}

// Keep the original single-entity functions for backward compatibility
export const syncPropertyTags = async (
  propertyId: string,
  ownerrezTags: OwnerRezTag[],
  tenantId: string
): Promise<void> => {
  await bulkSyncEntityTags(propertyId, ownerrezTags, tenantId, 'property')
}

export const syncBookingTags = async (
  bookingId: string,
  ownerrezTags: OwnerRezTag[],
  tenantId: string
): Promise<void> => {
  await bulkSyncEntityTags(bookingId, ownerrezTags, tenantId, 'booking')
}
