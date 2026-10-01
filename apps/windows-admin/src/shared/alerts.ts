import { DESKTOP_PATH, isInternalUrl, sectionUrl } from './endpoint'

/**
 * Checking what the admin page asks the native side to show.
 *
 * The page is the admin server's own, but the bridge is reachable from any
 * page the window loads, so nothing it sends is taken on trust: a notification
 * must come from the admin origin's top frame, its text is clipped, and the
 * place a click goes is resolved against the configured endpoint and must stay
 * inside the desktop shell — never a URL the message chose.
 */

export interface NativeAlert {
  title: string
  body: string
  /** Absolute URL in the shell to open when the notification is clicked. */
  url: string
}

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

export function parseAlert(endpoint: string, senderUrl: string, value: unknown): NativeAlert | null {
  if (!isInternalUrl(endpoint, senderUrl) || typeof value !== 'object' || value === null) return null

  const { title, body, path } = value as Record<string, unknown>
  const heading = clip(title, 120)
  if (!heading || typeof path !== 'string' || !path.startsWith(`${DESKTOP_PATH}?`)) return null

  return { title: heading, body: clip(body, 240), url: sectionUrl(endpoint, path) }
}

/**
 * A shipping label the admin page asks to print: an https image URL, from the
 * admin origin's own page. The label lives on the carrier's host (EasyPost's
 * file store), so it is not held to the admin origin — only to https.
 */
export function parseLabelUrl(endpoint: string, senderUrl: string, value: unknown): string | null {
  if (!isInternalUrl(endpoint, senderUrl) || typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/** A badge count the taskbar can show: a whole number from 0 to 9999, or null. */
export function parseBadge(endpoint: string, senderUrl: string, value: unknown): number | null {
  if (!isInternalUrl(endpoint, senderUrl)) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null
  return Math.min(value, 9999)
}

/**
 * Whether an alert repeats one already shown within `windowMs`.
 *
 * Every open window polls the same counts, so two windows would otherwise
 * announce the same new order twice.
 */
export function isRepeat(seen: Map<string, number>, alert: NativeAlert, now: number, windowMs = 90_000): boolean {
  for (const [key, at] of seen) if (now - at > windowMs) seen.delete(key)
  const key = `${alert.title}\u0000${alert.body}`
  if (seen.has(key)) return true
  seen.set(key, now)
  return false
}
