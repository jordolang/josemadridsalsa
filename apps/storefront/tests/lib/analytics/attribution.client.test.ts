import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ATTRIBUTION_COOKIE } from '@/lib/analytics/attribution'
import {
  captureFirstTouchAttribution,
  readCookieConsent,
  removeAttributionCookie,
} from '@/lib/analytics/attribution.client'

const CONSENT_KEY = 'cookie-consent'

function getCookie(name: string): string | null {
  const hit = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
  return hit ? hit.slice(name.length + 1) : null
}

function clearAllCookies(): void {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim()
    if (name) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
  }
}

beforeEach(() => {
  window.localStorage.clear()
  clearAllCookies()
  // A landing that carries a real marketing signal.
  window.history.replaceState({}, '', '/?utm_source=facebook')
})

afterEach(() => {
  window.localStorage.clear()
  clearAllCookies()
})

describe('readCookieConsent', () => {
  it('returns the stored choice, or null when unset or unrecognised', () => {
    expect(readCookieConsent()).toBeNull()
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    expect(readCookieConsent()).toBe('accepted')
    window.localStorage.setItem(CONSENT_KEY, 'rejected')
    expect(readCookieConsent()).toBe('rejected')
    window.localStorage.setItem(CONSENT_KEY, 'garbage')
    expect(readCookieConsent()).toBeNull()
  })
})

describe('captureFirstTouchAttribution — consent gating', () => {
  it('writes nothing before a choice is made', () => {
    captureFirstTouchAttribution()
    expect(getCookie(ATTRIBUTION_COOKIE)).toBeNull()
  })

  it('writes nothing when cookies were rejected', () => {
    window.localStorage.setItem(CONSENT_KEY, 'rejected')
    captureFirstTouchAttribution()
    expect(getCookie(ATTRIBUTION_COOKIE)).toBeNull()
  })

  it('writes the cookie once cookies are accepted and a signal is present', () => {
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    captureFirstTouchAttribution()
    const raw = getCookie(ATTRIBUTION_COOKIE)
    expect(raw).not.toBeNull()
    expect(decodeURIComponent(raw as string)).toContain('facebook')
  })
})

describe('removeAttributionCookie', () => {
  it('expires an existing attribution cookie', () => {
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    captureFirstTouchAttribution()
    expect(getCookie(ATTRIBUTION_COOKIE)).not.toBeNull()

    removeAttributionCookie()
    expect(getCookie(ATTRIBUTION_COOKIE)).toBeNull()
  })
})
