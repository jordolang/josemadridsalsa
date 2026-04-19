import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  createCodeChallenge,
  createCodeVerifier,
  parseSocialOAuthSession,
  serializeSocialOAuthSession,
} from '@/lib/social/oauth'

describe('lib/social/oauth', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips a valid oauth session payload', () => {
    const session = {
      state: 'abc123',
      platform: 'FACEBOOK' as const,
      userId: 'user_1',
      createdAt: Date.now(),
      codeVerifier: createCodeVerifier(),
    }

    expect(parseSocialOAuthSession(serializeSocialOAuthSession(session))).toEqual(session)
  })

  it('rejects expired oauth session payloads', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-19T00:00:00.000Z'))

    const raw = JSON.stringify({
      state: 'expired',
      platform: 'TIKTOK',
      userId: 'user_1',
      createdAt: Date.now() - 11 * 60 * 1000,
    })

    expect(parseSocialOAuthSession(raw)).toBeNull()
  })

  it('creates a URL-safe PKCE challenge', () => {
    const challenge = createCodeChallenge('fixed-verifier-for-test')

    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challenge).not.toContain('=')
  })
})
