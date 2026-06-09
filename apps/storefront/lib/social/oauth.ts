import crypto from 'crypto'
import type { SocialMediaPlatform } from '@prisma/client'

export const SOCIAL_OAUTH_COOKIE_NAME = 'social_oauth_session'
const SOCIAL_OAUTH_MAX_AGE_SECONDS = 10 * 60

export type SocialOAuthSession = {
  state: string
  platform: SocialMediaPlatform
  userId: string
  codeVerifier?: string
  createdAt: number
}

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString('hex')
}

export function createCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function createCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url')
}

export function serializeSocialOAuthSession(session: SocialOAuthSession): string {
  return JSON.stringify(session)
}

export function parseSocialOAuthSession(raw: string | undefined): SocialOAuthSession | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<SocialOAuthSession>

    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.platform !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null
    }

    if (Date.now() - parsed.createdAt > SOCIAL_OAUTH_MAX_AGE_SECONDS * 1000) {
      return null
    }

    if (parsed.codeVerifier && typeof parsed.codeVerifier !== 'string') {
      return null
    }

    return parsed as SocialOAuthSession
  } catch {
    return null
  }
}

export function getSocialOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SOCIAL_OAUTH_MAX_AGE_SECONDS,
  }
}
