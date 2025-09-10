/**
 * Security utilities and configuration
 * 
 * Note: Most security features are handled by Supabase Auth:
 * - Rate limiting (automatic)
 * - Session management (automatic refresh)
 * - Token expiry (configurable in dashboard)
 * - CSRF protection (via SameSite cookies)
 */

// Supabase auth rate limits (for reference):
// - Sign in: 30 requests per hour
// - Password recovery: 5 requests per hour
// - Sign up: 30 requests per hour
// - Token refresh: 30 requests per 5 minutes
// Reference: https://supabase.com/docs/guides/platform/going-into-prod#rate-limiting

// Supabase default token expiry times (for reference)
export const TOKEN_EXPIRY = {
  passwordReset: 60 * 60 * 1000, // 1 hour (Supabase default)
  emailVerification: 24 * 60 * 60 * 1000, // 24 hours (Supabase default)
  session: 7 * 24 * 60 * 60 * 1000, // 7 days (configurable in Supabase dashboard)
}

/**
 * Basic input sanitization for user-generated content
 * Note: React automatically escapes JSX content, so this is mainly for
 * data that might be used in dynamic contexts or stored in database
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Basic XSS prevention
    .slice(0, 1000) // Prevent excessive input
}

/**
 * Check if running in secure context (HTTPS or localhost)
 * Useful for features that require secure context like clipboard API
 */
export const isSecureContext = (): boolean => {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost'
}

/**
 * Content Security Policy headers for production
 * These should be implemented at the server/CDN level (e.g., Cloudflare)
 * rather than in client-side code
 * 
 * Example Cloudflare Worker implementation:
 * ```
 * response.headers.set('Content-Security-Policy', [
 *   "default-src 'self'",
 *   "script-src 'self'",
 *   "style-src 'self' 'unsafe-inline'", // Required for Tailwind
 *   "img-src 'self' data: https:",
 *   "font-src 'self'",
 *   "connect-src 'self' https://ojpmtekljijcurgzrses.supabase.co",
 * ].join('; '))
 * ```
 */

/**
 * Session security notes:
 * 
 * Session timeout and refresh are handled automatically by Supabase:
 * - Auto token refresh before expiry
 * - Configurable session duration in Supabase dashboard
 * - Secure session storage (httpOnly cookies when possible)
 * 
 * For custom session timeout warnings, you can:
 * 1. Listen to Supabase auth state changes
 * 2. Track user activity and warn before token expiry
 * 3. Use supabase.auth.refreshSession() to extend sessions
 */