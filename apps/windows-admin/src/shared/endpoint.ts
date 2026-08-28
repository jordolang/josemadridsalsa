/**
 * Where the desktop app is allowed to point, and how a section path becomes a URL.
 *
 * The app is a hardened window onto the real admin panel, so the origin it trusts
 * is the single most important setting it holds: every navigation, every external
 * link decision and the session cookies themselves are scoped to it.
 */

export const PRODUCTION_ORIGIN = 'https://www.josemadrid.net'

/**
 * The desktop shell — the admin data drawn as a native-feeling window rather
 * than the web panel's page chrome. It lives outside `/admin` because that
 * route group supplies a sidebar and top bar this window draws itself.
 */
export const DESKTOP_PATH = '/admin-desktop'
export const DEFAULT_ENDPOINT = `${PRODUCTION_ORIGIN}${DESKTOP_PATH}`

/**
 * What the default used to be, before the desktop shell existed.
 *
 * The app writes its settings file on every close, so an install that predates
 * the shell has the old default saved as if it were a deliberate choice and
 * would never see the new one. `migrateLegacyDefault` moves exactly that value
 * forward and leaves anything else — a localhost server, a hand-picked admin
 * page — alone.
 */
const LEGACY_DEFAULT_ENDPOINT = `${PRODUCTION_ORIGIN}/admin`

export function migrateLegacyDefault(endpoint: string): string {
  return endpoint === LEGACY_DEFAULT_ENDPOINT ? DEFAULT_ENDPOINT : endpoint
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase())
}

/**
 * Accept an HTTPS endpoint, or an HTTP one only when it is a developer's local
 * server. Anything else — a bare hostname, an http:// production host, a
 * file:// path — is rejected rather than silently corrected.
 */
export function validateEndpoint(value: string): { url: string } | { error: string } {
  const trimmed = value.trim()
  if (!trimmed) return { error: 'Enter an admin URL.' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { error: 'That is not a valid URL. Include https:// at the start.' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: 'Only http and https URLs are supported.' }
  }

  if (parsed.protocol === 'http:' && !isLocalHost(parsed.hostname)) {
    return { error: 'HTTPS is required except for localhost development servers.' }
  }

  // A bare origin means "the desktop shell", which is what this app opens on.
  if (parsed.pathname === '' || parsed.pathname === '/') {
    parsed.pathname = DESKTOP_PATH
  }

  parsed.hash = ''
  parsed.search = ''

  return { url: parsed.toString().replace(/\/$/, '') }
}

export function originOf(endpoint: string): string {
  return new URL(endpoint).origin
}

/** Resolve an admin path (`/admin/orders`) against the configured endpoint. */
export function sectionUrl(endpoint: string, path: string): string {
  return new URL(path, originOf(endpoint)).toString()
}

/**
 * Whether a URL belongs to the configured admin server.
 */
export function isInternalUrl(endpoint: string, target: string): boolean {
  try {
    return new URL(target).origin === originOf(endpoint)
  } catch {
    return false
  }
}

/**
 * Identity providers NextAuth redirects through during sign-in.
 *
 * These have to render in the app window rather than the default browser: an
 * OAuth round trip that finishes in Safari or Edge sets the session cookie
 * there, and the app is left sitting on the sign-in page forever. Google's
 * One Tap prompt starts this redirect on its own, so it is not enough to only
 * handle a deliberate click on "Continue with Google".
 */
const AUTH_ORIGINS = new Set([
  'https://accounts.google.com',
  'https://accounts.youtube.com',
  'https://oauth2.googleapis.com',
  'https://github.com',
  'https://facebook.com',
  'https://www.facebook.com',
  'https://m.facebook.com',
  'https://appleid.apple.com',
])

export function isAuthUrl(target: string): boolean {
  try {
    return AUTH_ORIGINS.has(new URL(target).origin)
  } catch {
    return false
  }
}

/**
 * Whether a URL should open inside the app window. The admin server and the
 * sign-in providers stay in; everything else — Stripe, QuickBooks, Vercel, a
 * customer's website — is handed to the default browser.
 */
export function shouldOpenInApp(endpoint: string, target: string): boolean {
  return isInternalUrl(endpoint, target) || isAuthUrl(target)
}

/** Only ever hand http(s) links to the OS — never file:, and never a custom scheme. */
export function isSafeExternalUrl(target: string): boolean {
  try {
    const { protocol } = new URL(target)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
