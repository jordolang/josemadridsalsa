/**
 * Simple in-memory rate limiter for email API endpoints
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)

/**
 * Check rate limit for a given key (e.g., IP address)
 * @returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  { maxRequests = 10, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true }
}

/**
 * Validate SERVICE_API_KEY for internal service endpoints
 */
export function validateServiceApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.SERVICE_API_KEY
  if (!expectedKey) {
    console.warn('SERVICE_API_KEY not configured - denying request')
    return false
  }
  return apiKey === expectedKey
}
