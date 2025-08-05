import { query, transaction, DbResult } from './database';

type OwnerRezTag = {
  id: number
  name: string
  color?: string
}

type TagMapping = ReadonlyMap<string, string>

type TagType = 'property' | 'booking' | 'guest' | 'payment'

const createTagRecord = (tag: OwnerRezTag, tenantId: string, type: TagType) => ({
  tenant_id: tenantId,
  ownerrez_id: tag.id.toString(),
  name: tag.name,
  type,
  color: tag.color || null
})

const upsertTag = async (
  tag: OwnerRezTag,
  tenantId: string,
  type: TagType
): Promise<DbResult<string>> => {
  if (!tag || typeof tag.id !== 'number' || !tag.name) {
    console.warn(`Skipping invalid tag:`, tag)
    return { success: false, error: 'Invalid tag data' }
  }

  const tagRecord = createTagRecord(tag, tenantId, type)

  const result = await query<{ id: string }>(
    `INSERT INTO tags (tenant_id, ownerrez_id, name, type, color)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, ownerrez_id) DO UPDATE
     SET name = EXCLUDED.name,
         color = EXCLUDED.color,
         updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    Object.values(tagRecord)
  )

  return result.success && result.data.length > 0
    ? { success: true, data: result.data[0].id }
    : { success: false, error: 'Failed to upsert tag' }
}

const ensureTags = async (
  tags: readonly OwnerRezTag[],
  tenantId: string,
  type: TagType
): Promise<TagMapping> => {
  const results = await Promise.all(
    tags.map(tag => upsertTag(tag, tenantId, type))
  )

  const entries = tags
    .map((tag, index) => {
      const result = results[index]
      return result.success ? [tag.id.toString(), result.data] as const : null
    })
    .filter((entry): entry is [string, string] => entry !== null)

  return new Map(entries)
}

const clearEntityTags = async (
  entityId: string,
  entityType: 'property' | 'booking'
): Promise<DbResult<void>> => {
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

const insertEntityTags = async (
  entityId: string,
  tagIds: readonly string[],
  entityType: 'property' | 'booking'
): Promise<DbResult<void>> => {
  const table = entityType === 'property' ? 'property_tags' : 'booking_tags'
  const columns = entityType === 'property'
    ? '(property_id, tag_id)'
    : '(booking_id, tag_id)'

  return transaction(async (client) => {
    for (const tagId of tagIds) {
      await client.query(
        `INSERT INTO ${table} ${columns} VALUES ($1, $2)`,
        [entityId, tagId]
      )
    }
  })
}

const syncEntityTags = async (
  entityId: string,
  ownerrezTags: readonly OwnerRezTag[],
  tenantId: string,
  entityType: 'property' | 'booking'
): Promise<DbResult<void>> => {
  if (!ownerrezTags || ownerrezTags.length === 0) {
    return clearEntityTags(entityId, entityType)
  }

  const tagType = entityType === 'property' ? 'property' : 'booking'
  const tagMapping = await ensureTags(ownerrezTags, tenantId, tagType)

  return transaction(async (client) => {
    await client.query(
      `DELETE FROM ${entityType}_tags WHERE ${entityType}_id = $1`,
      [entityId]
    )

    const tagIds = Array.from(tagMapping.values())
    for (const tagId of tagIds) {
      await client.query(
        `INSERT INTO ${entityType}_tags (${entityType}_id, tag_id) VALUES ($1, $2)`,
        [entityId, tagId]
      )
    }
  })
}

export const syncPropertyTags = async (
  propertyId: string,
  ownerrezTags: OwnerRezTag[],
  tenantId: string
): Promise<void> => {
  await syncEntityTags(propertyId, ownerrezTags, tenantId, 'property')
}

export const syncBookingTags = async (
  bookingId: string,
  ownerrezTags: OwnerRezTag[],
  tenantId: string
): Promise<void> => {
  await syncEntityTags(bookingId, ownerrezTags, tenantId, 'booking')
}

const tagTypePatterns: ReadonlyArray<[RegExp, TagType]> = [
  [/ach|zelle|paypal|venmo|wire|check|credit|debit/i, 'payment'],
  [/beachfront|pool|hot tub|pet|wifi|parking/i, 'property'],
  [/repeat|vip|guest/i, 'guest']
]

export const inferTagType = (tagName: string): TagType => {
  const matchedPattern = tagTypePatterns.find(([pattern]) => pattern.test(tagName))
  return matchedPattern ? matchedPattern[1] : 'booking'
}
