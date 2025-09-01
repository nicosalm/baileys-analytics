// supabase auth handles rate limiting automatically:
// - sign in: 30 requests per hour
// - password recovery: 5 requests per hour
// - sign up: 30 requests per hour
// - token refresh: 30 requests per 5 minutes
// reference: https://supabase.com/docs/guides/platform/going-into-prod#rate-limiting

// supabase default token expiry times
export const TOKEN_EXPIRY = {
  passwordReset: 60 * 60 * 1000, // 1 hour (supabase default)
  emailVerification: 24 * 60 * 60 * 1000, // 24 hours (supabase default)
  session: 7 * 24 * 60 * 60 * 1000, // 7 days (configurable in supabase dashboard)
}

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // basic XSS prevention
    .slice(0, 1000) // prevent excessive input
}

export const isSecureContext = (): boolean => {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost'
}

// TODO: implement CSP headers on server
export const getCSPHeaders = () => ({
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // TODO: remove unsafe-inline in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://ojpmtekljijcurgzrses.supabase.co",
  ].join('; ')
})

// session timeout warning
export const setupSessionTimeout = (onTimeout: () => void, timeoutMs = TOKEN_EXPIRY.session) => {
  let timer: NodeJS.Timeout
  let warningTimer: NodeJS.Timeout
  
  const resetTimers = () => {
    clearTimeout(timer)
    clearTimeout(warningTimer)
    
    // TODO: show warning 5 minutes before timeout
    warningTimer = setTimeout(() => {
      console.warn('Session will expire in 5 minutes')
    }, timeoutMs - 5 * 60 * 1000)
    
    timer = setTimeout(onTimeout, timeoutMs)
  }
  
  // reset on user activity
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
  events.forEach(event => {
    document.addEventListener(event, resetTimers, { passive: true })
  })
  
  resetTimers()
  
  return () => {
    clearTimeout(timer)
    clearTimeout(warningTimer)
    events.forEach(event => {
      document.removeEventListener(event, resetTimers)
    })
  }
}