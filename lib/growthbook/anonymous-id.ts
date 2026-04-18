const COOKIE_NAME = 'gb_anon_id'
const TWO_YEARS_SECONDS = 60 * 60 * 24 * 365 * 2

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie
    .split(';')
    .map((row) => row.trim())
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `gb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Returns the browser's sticky anonymous identifier, creating + persisting
 * one on first call. Returns `''` during SSR — IDs minted on the server
 * can't be persisted into a response cookie from here and would be thrown
 * away on every request, so mint only in the browser.
 */
export function readOrCreateAnonymousId(): string {
  if (typeof document === 'undefined') return ''
  const existing = readCookie(COOKIE_NAME)
  if (existing) return existing
  const fresh = generateId()
  writeCookie(COOKIE_NAME, fresh, TWO_YEARS_SECONDS)
  return fresh
}
