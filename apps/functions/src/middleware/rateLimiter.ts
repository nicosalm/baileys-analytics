import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { corsHeaders } from './auth';

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(private config: RateLimitConfig) {}

  private getKey(request: HttpRequest): string {
    // Use IP + endpoint as key
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const path = new URL(request.url).pathname;
    return `${ip}:${path}`;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.attempts.entries()) {
      if (value.resetAt < now) {
        this.attempts.delete(key);
      }
    }
  }

  check(request: HttpRequest): { allowed: boolean; response?: HttpResponseInit } {
    this.cleanup();

    const key = this.getKey(request);
    const now = Date.now();

    const attempt = this.attempts.get(key);

    if (!attempt || attempt.resetAt < now) {
      // New window
      this.attempts.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs
      });
      return { allowed: true };
    }

    if (attempt.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((attempt.resetAt - now) / 1000);
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
      };
    }

    attempt.count++;
    return { allowed: true };
  }
}

// Different limiters for different endpoints
export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5 // 5 attempts per 15 min
});

export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30 // 30 requests per minute
});

// Middleware function
export const withRateLimit = (
  limiter: RateLimiter,
  handler: Function
) => {
  return async (request: HttpRequest, context: any) => {
    const { allowed, response } = limiter.check(request);

    if (!allowed) {
      return response;
    }

    return handler(request, context);
  };
};
