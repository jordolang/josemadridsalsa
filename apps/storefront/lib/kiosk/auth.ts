/**
 * Who may ring up a kiosk sale: a paired kiosk tablet (its device token, sent by the
 * Android app as `Authorization: Bearer <token>`) or a staff member with `orders:write` testing
 * /kiosk in a browser. Tokens live in KIOSK_DEVICE_TOKENS, comma-separated, one per tablet.
 */
import { timingSafeEqual } from 'crypto'
import { requirePermission } from '@/lib/rbac'

export class KioskAuthError extends Error {}

function configuredTokens(): string[] {
  return (process.env.KIOSK_DEVICE_TOKENS ?? '')
    .split(',')
    .map((t) => t.trim())
    // A short token is guessable; refuse it rather than protect a till with it.
    .filter((t) => t.length >= 24)
}

export function isValidKioskToken(token: string | null | undefined): boolean {
  if (!token) return false
  const given = Buffer.from(token)
  return configuredTokens().some((t) => {
    const expected = Buffer.from(t)
    return expected.length === given.length && timingSafeEqual(expected, given)
  })
}

export async function requireKioskAccess(request: Request): Promise<'device' | 'staff'> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
  if (token) {
    if (isValidKioskToken(token)) return 'device'
    throw new KioskAuthError('This kiosk is not paired. Check its device token.')
  }
  try {
    await requirePermission('orders:write')
    return 'staff'
  } catch {
    throw new KioskAuthError('This kiosk is not paired. Check its device token.')
  }
}
