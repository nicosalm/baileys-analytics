import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { corsHeaders } from './auth';

type RateLimitConfig = {
  windowMs: number
  maxRequests: number
}

type RateLimitAttempt = {
  count: number
  resetAt: number
}

type RateLimitCheck =
  | { allowed: true }
  | { allowed: false; response: HttpResponseInit }

class RateLimiter {
  private attempts = new Map<string, RateLimitAttempt>()

  constructor(private config: RateLimitConfig) {}

  private getKey(request: HttpRequest): string {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const path = new URL(request.url).pathname
    return `${ip}:${path}`
  }

  private cleanup(): void {
    const now = Date.now()
    const keysToDelete = Array.from(this.attempts.entries())
      .filter(([_, value]) => value.resetAt < now)
      .map(([key]) => key)

    keysToDelete.forEach(key => this.attempts.delete(key))
  }

  check(request: HttpRequest): RateLimitCheck {
    this.cleanup()

    const key = this.getKey(request)
    const now = Date.now()
    const attempt = this.attempts.get(key)

    if (!attempt || attempt.resetAt < now) {
      this.attempts.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs
      })
      return { allowed: true }
    }

    if (attempt.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((attempt.resetAt - now) / 1000)
      return {
        allowed: false,
        response: {
          status: 429,
          headers: {
            ...corsHeaders(),
            'Retry-After': retryAfter.toString()
          },
          jsonBody: {
            error: 'Too many requests',
            retryAfter
          }
        }
      }
    }

    this.attempts.set(key, {
      ...attempt,
      count: attempt.count + 1
    })

    return { allowed: true }
  }
}

export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5
})

export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30
})

export const withRateLimit = (
  limiter: RateLimiter,
  handler: Function
) => {
  return async (request: HttpRequest, context: any) => {
    const result = limiter.check(request)

    if (!result.allowed) {
      return result.response
    }

    return handler(request, context)
  }
}
