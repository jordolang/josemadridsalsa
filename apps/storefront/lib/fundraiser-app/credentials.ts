/**
 * The secrets behind the mobile fundraiser app.
 *
 * A seller sets the app up with three things: the group ID, the group PIN, and their own first
 * and last name. After that they choose a personal PIN, which unlocks the app every time it
 * opens. The phone keeps a device token so it stays signed in for the whole campaign.
 *
 * PINs are short by design — they are typed by students on a phone — so they are only as strong
 * as the lockouts in front of them (see `nextLockout`). Both PINs are stored as bcrypt hashes;
 * device tokens are long random values, so a SHA-256 of them is enough.
 */
import { createHash, randomBytes, randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

/** No 0/O, 1/I/L or 5/S: a group ID is read aloud and copied off a whiteboard. */
const GROUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789'
export const GROUP_CODE_LENGTH = 6

export function generateGroupCode(): string {
  return Array.from({ length: GROUP_CODE_LENGTH }, () =>
    GROUP_CODE_ALPHABET.charAt(randomInt(GROUP_CODE_ALPHABET.length))
  ).join('')
}

/** What a seller typed, as it is stored: upper case, spaces and dashes dropped. */
export function normalizeGroupCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export const GroupCodeSchema = z
  .string()
  .transform(normalizeGroupCode)
  .pipe(z.string().regex(/^[A-Z0-9]{4,12}$/, 'Enter the group ID you were given'))

export const PinSchema = z.string().regex(/^\d{4,6}$/, 'PINs are 4 to 6 digits')

export const SellerNameSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name').max(50),
  lastName: z.string().trim().min(1, 'Enter your last name').max(50),
})

/** "  mary   ann " → "Mary Ann". Names are matched on this form, ignoring case. */
export function cleanName(part: string): string {
  return part
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function displayName(firstName: string, lastName: string): string {
  return `${cleanName(firstName)} ${cleanName(lastName)}`
}

const PIN_HASH_ROUNDS = 10

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_HASH_ROUNDS)
}

export function verifyPin(pin: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return Promise.resolve(false)
  return bcrypt.compare(pin, hash)
}

/** A new device token. The phone keeps the raw value; the server keeps `hashSessionToken`. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Wrong personal PINs before the seller is locked out for a while. */
export const SELLER_PIN_MAX_FAILURES = 5
export const SELLER_PIN_LOCK_MINUTES = 15
/**
 * Wrong group PINs (across everyone) before new sign-ups pause. Set high, because a whole class
 * may be fumbling it at once; the lockout is there to stop a script, not a typo.
 */
export const GROUP_PIN_MAX_FAILURES = 25
export const GROUP_PIN_LOCK_MINUTES = 10

/** Whether a lock is still in force. */
export function isLocked(lockedUntil: Date | null | undefined, now = new Date()): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime()
}

/**
 * What a wrong PIN does to the failure counter: count it, and once the limit is reached start a
 * lock and begin counting again from zero.
 */
export function nextLockout(
  failures: number,
  limit: { maxFailures: number; lockMinutes: number },
  now = new Date()
): { failures: number; lockedUntil: Date | null } {
  const next = failures + 1
  if (next < limit.maxFailures) return { failures: next, lockedUntil: null }
  return { failures: 0, lockedUntil: new Date(now.getTime() + limit.lockMinutes * 60_000) }
}

/** How long a correct PIN keeps the app unlocked for taking orders. */
export const UNLOCK_WINDOW_HOURS = 12

export function isUnlocked(unlockedAt: Date | null | undefined, now = new Date()): boolean {
  return !!unlockedAt && now.getTime() - unlockedAt.getTime() < UNLOCK_WINDOW_HOURS * 3_600_000
}
