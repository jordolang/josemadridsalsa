import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'

const COOKIE_NAME = 'jms_guest'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export type GuestTokenInfo = {
  token: string
  isNew: boolean
}

export async function getOrCreateGuestToken(): Promise<GuestTokenInfo> {
  const store = await cookies()
  const existing = store.get(COOKIE_NAME)?.value
  if (existing && existing.length >= 8) {
    return { token: existing, isNew: false }
  }
  const token = randomUUID()
  store.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return { token, isNew: true }
}

export async function readGuestToken(): Promise<string | null> {
  const store = await cookies()
  const value = store.get(COOKIE_NAME)?.value
  return value && value.length >= 8 ? value : null
}

export function guestDisplayName(token: string): string {
  // Stable, short, human label like "Guest-A4F2".
  const suffix = token.replace(/-/g, '').slice(0, 4).toUpperCase()
  return `Guest-${suffix}`
}
