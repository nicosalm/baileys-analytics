// UUID v4 validation regex - strict validation for security
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Maximum allowed length for any parameter value (prevent DOS)
// Maximum number of IDs in a comma-separated list
const MAX_ID_COUNT = 100

// Validate if a string is a valid UUID v4
export function isValidUUID(value: string): boolean {
  // Length check for security (UUID v4 is always 36 chars)
  if (value.length !== 36) return false
  return UUID_V4_REGEX.test(value)
}

// Validate and filter an array of potential UUIDs
export function filterValidUUIDs(values: string[]): string[] {
  // Limit array size for security
  const limitedValues = values.slice(0, MAX_ID_COUNT)
  return limitedValues.filter(isValidUUID)
}

// Validate date string (YYYY-MM-DD format)
export function isValidDateString(date: string): boolean {
  // Length check (YYYY-MM-DD is exactly 10 chars)
  if (date.length !== 10) return false
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false
  }
  
  const parsed = new Date(date)
  // Additional validation: ensure date is reasonable (not too far in past/future)
  const year = parsed.getFullYear()
  if (year < 1900 || year > 2100) return false
  
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
}
