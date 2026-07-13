import { describe, expect, it, afterEach } from 'vitest'
import { getSocialBaseUrl } from '@/lib/social/platforms'

describe('getSocialBaseUrl', () => {
  const original = process.env.NEXTAUTH_URL

  afterEach(() => {
    process.env.NEXTAUTH_URL = original
  })

  it('returns NEXTAUTH_URL untouched when already clean', () => {
    process.env.NEXTAUTH_URL = 'https://www.josemadrid.net'
    expect(getSocialBaseUrl()).toBe('https://www.josemadrid.net')
  })

  it('strips a trailing slash so the callback never gets a double slash', () => {
    process.env.NEXTAUTH_URL = 'https://www.josemadrid.net/'
    expect(`${getSocialBaseUrl()}/api/social/oauth/callback`).toBe(
      'https://www.josemadrid.net/api/social/oauth/callback',
    )
  })

  it('trims stray whitespace pasted into the env var', () => {
    process.env.NEXTAUTH_URL = '  https://www.josemadrid.net/  \n'
    expect(getSocialBaseUrl()).toBe('https://www.josemadrid.net')
  })

  it('falls back to localhost when NEXTAUTH_URL is unset', () => {
    delete process.env.NEXTAUTH_URL
    expect(getSocialBaseUrl()).toBe('http://localhost:3000')
  })
})
