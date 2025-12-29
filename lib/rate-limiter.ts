/**
 * Rate Limiter - Prevent API abuse
 * José Madrid Salsa E-commerce Platform
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
// For production with multiple servers, use Redis or database
const rateLimitStore = new Map<string, RateLimitRecord>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Window duration in seconds */
  windowSeconds: number
  /** Unique identifier (IP address, user ID, etc.) */
  identifier: string
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining */
  remaining: number
  /** Time until rate limit resets (seconds) */
  resetIn: number
  /** Current request count */
  current: number
}

/**
 * Check if a request is allowed under rate limit
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowSeconds, identifier } = config
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // Get or create rate limit record
  let record = rateLimitStore.get(identifier)

  if (!record || now > record.resetTime) {
    // Create new record or reset expired one
    record = {
      count: 0,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(identifier, record)
  }

  // Increment request count
  record.count++

  const allowed = record.count <= maxRequests
  const remaining = Math.max(0, maxRequests - record.count)
  const resetIn = Math.ceil((record.resetTime - now) / 1000)

  return {
    allowed,
    remaining,
    resetIn,
    current: record.count,
  }
}

/**
 * Rate limit presets for different API endpoints
 */
export const RATE_LIMITS = {
  // AI Chat: 20 requests per minute per IP
  AI_CHAT: {
    maxRequests: 20,
    windowSeconds: 60,
  },

  // AI Chat (authenticated users): 50 requests per minute
  AI_CHAT_USER: {
    maxRequests: 50,
    windowSeconds: 60,
  },

  // General API: 100 requests per minute
  API_GENERAL: {
    maxRequests: 100,
    windowSeconds: 60,
  },

  // Authentication: 5 login attempts per 15 minutes
  AUTH_LOGIN: {
    maxRequests: 5,
    windowSeconds: 15 * 60,
  },

  // Password reset: 3 requests per hour
  PASSWORD_RESET: {
    maxRequests: 3,
    windowSeconds: 60 * 60,
  },
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP in the list
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a generic identifier
  return 'unknown-ip'
}

/**
 * Create rate limit headers for API responses
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.current.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
  }
}
