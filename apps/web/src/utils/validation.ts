// UUID v4 validation regex - strict validation for security
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Maximum allowed length for any parameter value (prevent DOS)
const MAX_PARAM_LENGTH = 1000

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

// Sanitize and validate URL parameters
export function sanitizeUrlParams(params: {
  from?: string | null
  to?: string | null
  tags?: string | null
  properties?: string | null
}): {
  from?: string
  to?: string
  tagIds: string[]
  propertyIds: string[]
} {
  const result: {
    from?: string
    to?: string
    tagIds: string[]
    propertyIds: string[]
  } = {
    tagIds: [],
    propertyIds: []
  }
  
  // Validate dates
  if (params.from && isValidDateString(params.from)) {
    result.from = params.from
  }
  
  if (params.to && isValidDateString(params.to)) {
    result.to = params.to
  }
  
  // Validate and filter tag IDs (must be UUIDs)
  if (params.tags && params.tags.length < MAX_PARAM_LENGTH) {
    const tagIds = params.tags.split(',').filter(Boolean).slice(0, MAX_ID_COUNT)
    result.tagIds = filterValidUUIDs(tagIds)
  }
  
  // Validate and filter property IDs (must be UUIDs)
  if (params.properties && params.properties.length < MAX_PARAM_LENGTH) {
    const propertyIds = params.properties.split(',').filter(Boolean).slice(0, MAX_ID_COUNT)
    result.propertyIds = filterValidUUIDs(propertyIds)
  }
  
  return result
}

// Check if a string looks like it might be user input rather than an ID
export function isLikelyUserInput(value: string): boolean {
  // Check for common patterns that indicate user input
  const userInputPatterns = [
    /^add\s+/i,              // Starts with "add"
    /^create\s+/i,           // Starts with "create"
    /^new\s+/i,              // Starts with "new"
    /\s+/,                   // Contains spaces (UUIDs don't have spaces)
    /[A-Z]/,                 // Contains uppercase (UUIDs are lowercase)
    /[^0-9a-f-]/i,           // Contains non-hex characters (except dash)
  ]
  
  return userInputPatterns.some(pattern => pattern.test(value))
}

// Clean an array of IDs, removing invalid entries
export function cleanIdArray(ids: string[]): string[] {
  // Limit input size first
  const limitedIds = ids.slice(0, MAX_ID_COUNT)
  
  return limitedIds.filter(id => {
    // Filter out empty strings
    if (!id || id.trim() === '') return false
    
    // Filter out likely user input
    if (isLikelyUserInput(id)) return false
    
    // Only keep valid UUIDs
    return isValidUUID(id)
  })
}

// Escape HTML entities to prevent XSS
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// Safely encode value for URL parameter
export function encodeUrlParam(value: string): string {
  // First escape any HTML entities, then URL encode
  return encodeURIComponent(escapeHtml(value))
}

// Safely decode URL parameter
export function decodeUrlParam(value: string): string {
  try {
    const decoded = decodeURIComponent(value)
    // Additional validation after decoding
    if (decoded.length > MAX_PARAM_LENGTH) {
      return ''
    }
    return decoded
  } catch (e) {
    // Invalid encoding, return empty string for safety
    return ''
  }
}