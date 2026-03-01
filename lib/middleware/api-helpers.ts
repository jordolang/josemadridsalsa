/**
 * API Middleware Helpers - Reusable wrappers for auth and rate limiting
 * José Madrid Salsa E-commerce Platform
 */

import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import {
  getCurrentUser,
  hasRole,
  hasPermission,
} from '@/lib/rbac'
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/rate-limiter'

type ApiHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse

interface AuthOptions {
  /** Require authentication (default: true) */
  required?: boolean
  /** Allowed roles (optional) */
  roles?: UserRole[]
  /** Required permission (optional) */
  permission?: string
}

interface RateLimitOptions {
  /** Maximum requests allowed */
  maxRequests: number
  /** Window duration in seconds */
  windowSeconds: number
  /** Use user ID instead of IP for authenticated users */
  useUserId?: boolean
}

/**
 * Wrap an API route handler with authentication
 *
 * @example
 * ```ts
 * export const POST = withAuth(async (request) => {
 *   // User is authenticated here
 *   return NextResponse.json({ success: true })
 * }, { roles: [UserRole.ADMIN] })
 * ```
 */
export function withAuth(
  handler: ApiHandler,
  options: AuthOptions = {}
): ApiHandler {
  const { required = true, roles, permission } = options

  return async (request: NextRequest, context?: any) => {
    try {
      const user = await getCurrentUser()

      // Check if authentication is required
      if (required && !user) {
        return NextResponse.json(
          { error: 'Unauthorized - authentication required' },
          { status: 401 }
        )
      }

      // Check role requirements
      if (roles && roles.length > 0 && !hasRole(user, roles)) {
        return NextResponse.json(
          { error: `Forbidden - requires one of: ${roles.join(', ')}` },
          { status: 403 }
        )
      }

      // Check permission requirements
      if (permission && user) {
        const hasPerm = await hasPermission(user, permission)
        if (!hasPerm) {
          return NextResponse.json(
            { error: `Forbidden - requires permission: ${permission}` },
            { status: 403 }
          )
        }
      }

      // Call the wrapped handler
      return await handler(request, context)
    } catch (error) {
      console.error('[withAuth] Error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Wrap an API route handler with rate limiting
 *
 * @example
 * ```ts
 * export const POST = withRateLimit(async (request) => {
 *   return NextResponse.json({ success: true })
 * }, RATE_LIMITS.API_GENERAL)
 * ```
 */
export function withRateLimit(
  handler: ApiHandler,
  options: RateLimitOptions
): ApiHandler {
  const { maxRequests, windowSeconds, useUserId = false } = options

  return async (request: NextRequest, context?: any) => {
    try {
      // Determine rate limit identifier
      let identifier = getClientIdentifier(request)

      // Use user ID for authenticated users if enabled
      if (useUserId) {
        const user = await getCurrentUser()
        if (user) {
          identifier = `user-${user.id}`
        }
      }

      // Check rate limit
      const rateLimitResult = checkRateLimit({
        maxRequests,
        windowSeconds,
        identifier,
      })

      // Add rate limit headers to response
      const headers = createRateLimitHeaders(rateLimitResult)

      // Reject if rate limit exceeded
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            retryAfter: rateLimitResult.resetIn,
          },
          {
            status: 429,
            headers,
          }
        )
      }

      // Call the wrapped handler
      const response = await handler(request, context)

      // Add rate limit headers to successful response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    } catch (error) {
      console.error('[withRateLimit] Error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Compose multiple middleware wrappers
 * Applied from right to left (last to first)
 *
 * @example
 * ```ts
 * export const POST = compose(
 *   withAuth({ roles: [UserRole.ADMIN] }),
 *   withRateLimit(RATE_LIMITS.API_GENERAL)
 * )(async (request) => {
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function compose(...middlewares: ((handler: ApiHandler) => ApiHandler)[]): (handler: ApiHandler) => ApiHandler {
  return (handler: ApiHandler) => {
    return middlewares.reduceRight(
      (wrapped, middleware) => middleware(wrapped),
      handler
    )
  }
}

/**
 * Common rate limit presets for convenience
 */
export const commonRateLimits = {
  /** Standard API endpoints - 100 req/min */
  standard: (handler: ApiHandler) =>
    withRateLimit(handler, RATE_LIMITS.API_GENERAL),

  /** AI/Chat endpoints - 20 req/min for guests, 50 for users */
  aiChat: (handler: ApiHandler) =>
    withRateLimit(handler, {
      ...RATE_LIMITS.AI_CHAT,
      useUserId: true,
    }),

  /** Auth endpoints - 5 attempts per 15 min */
  auth: (handler: ApiHandler) =>
    withRateLimit(handler, RATE_LIMITS.AUTH_LOGIN),

  /** Password reset - 3 req/hour */
  passwordReset: (handler: ApiHandler) =>
    withRateLimit(handler, RATE_LIMITS.PASSWORD_RESET),
}

/**
 * Common auth presets for convenience
 */
export const commonAuth = {
  /** Require any authenticated user */
  required: (handler: ApiHandler) =>
    withAuth(handler, { required: true }),

  /** Optional authentication */
  optional: (handler: ApiHandler) =>
    withAuth(handler, { required: false }),

  /** Admin only */
  admin: (handler: ApiHandler) =>
    withAuth(handler, { roles: [UserRole.ADMIN] }),

  /** Staff or higher */
  staff: (handler: ApiHandler) =>
    withAuth(handler, {
      roles: [UserRole.ADMIN, UserRole.DEVELOPER, UserRole.STAFF],
    }),
}
