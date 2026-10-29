import bcrypt from 'bcryptjs'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

/**
 * Thrown from the credentials authorize() when a sign-in is throttled, so the
 * sign-in form can say so instead of "invalid password". It is raised before the
 * account is looked up, so it reveals nothing about whether the email exists.
 */
export const SIGN_IN_THROTTLED = 'SIGN_IN_THROTTLED'

/**
 * Email for sign-in logs: the first two characters of the local part and the
 * domain, so logs can still be correlated without holding full addresses.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '***'
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`
}

/** Headers as NextAuth passes them to authorize(): a plain, lowercase-keyed object. */
type SignInHeaders = Record<string, unknown> | undefined

function readHeader(headers: SignInHeaders, name: string): string | undefined {
  const value = headers?.[name]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : undefined
}

/**
 * Client IP for a sign-in request. Vercel sets x-forwarded-for itself, so the
 * first entry is the caller and cannot be spoofed from outside.
 */
export function getSignInClientIp(headers: SignInHeaders): string | null {
  const forwarded = readHeader(headers, 'x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded

  const realIp = readHeader(headers, 'x-real-ip')?.trim()
  return realIp || null
}

/**
 * Counts one credentials sign-in attempt against the per-IP and per-email limits.
 *
 * The per-IP limit is checked first, so a blocked IP does not also burn the
 * email's allowance. Credential stuffing spreads a few tries over many emails,
 * which only the per-IP limit catches; the per-email limit catches many IPs
 * aimed at one account.
 */
export async function isSignInAllowed({
  email,
  ip,
}: {
  email: string
  ip: string | null
}): Promise<boolean> {
  if (ip) {
    const byIp = await checkRateLimit({
      identifier: `auth:login:ip:${ip}`,
      maxRequests: RATE_LIMITS.AUTH_LOGIN_IP.maxRequests,
      windowSeconds: RATE_LIMITS.AUTH_LOGIN_IP.windowSeconds,
    })
    if (!byIp.allowed) {
      console.warn('[Auth] Sign-in rate limit exceeded for IP:', ip, `- resets in ${byIp.resetIn}s`)
      return false
    }
  }

  const byEmail = await checkRateLimit({
    identifier: `auth:login:${email}`,
    maxRequests: RATE_LIMITS.AUTH_LOGIN.maxRequests,
    windowSeconds: RATE_LIMITS.AUTH_LOGIN.windowSeconds,
  })
  if (!byEmail.allowed) {
    console.warn('[Auth] Sign-in rate limit exceeded for:', maskEmail(email), `- resets in ${byEmail.resetIn}s`)
    return false
  }

  return true
}

/**
 * Cost-12 hash of a random string nobody kept, the same cost as customer
 * registration, so a dummy compare takes as long as a real one. Precomputed so
 * the first unknown email on a fresh instance does not also pay for hashing.
 */
const DUMMY_HASH = '$2b$12$/dpWvzyR5JMD7q.T0UjwPOPifXNuCH49jE5BcsJC2SyaEt1GEJMOq'

/**
 * Runs a bcrypt compare that always fails, for sign-ins with no account or no
 * password. Without it those requests return before bcrypt runs, and the faster
 * response tells an attacker which emails have no account.
 */
export async function compareAgainstDummyHash(password: string): Promise<false> {
  await bcrypt.compare(password, DUMMY_HASH)
  return false
}
