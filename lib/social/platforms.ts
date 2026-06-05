import type { ShopPlatform, SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

const FACEBOOK_OAUTH_SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_show_list',
  'pages_manage_metadata',
  'catalog_management',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
]

const TIKTOK_OAUTH_SCOPES = [
  'user.info.basic',
  'video.publish',
  'video.upload',
]

export function getSocialBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

// Both FACEBOOK_APP_* (Graph API convention) and FACEBOOK_CLIENT_* (NextAuth
// convention) are accepted so a single Facebook app credential pair powers
// both NextAuth sign-in and the social publisher without duplicate secrets.
// We MUST pair id+secret from the same convention; mixing them across two
// different Facebook apps returns OAuth state mismatches that are confusing
// to debug. Prefer APP_* when the full pair is set, otherwise CLIENT_*.
function getFacebookAppCredentials() {
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    return {
      appId: process.env.FACEBOOK_APP_ID,
      appSecret: process.env.FACEBOOK_APP_SECRET,
    }
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    return {
      appId: process.env.FACEBOOK_CLIENT_ID,
      appSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }
  }
  // Partial — surface as not configured so the UI shows a clear error.
  return { appId: undefined, appSecret: undefined }
}

export function getFacebookAppId(): string | undefined {
  return getFacebookAppCredentials().appId
}

export function getFacebookAppSecret(): string | undefined {
  return getFacebookAppCredentials().appSecret
}

/**
 * Get a connected social account's decrypted access token
 */
export async function getAccountAccessToken(accountId: string): Promise<string | null> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || !account.isActive) return null

  try {
    return decryptSecret(account.accessToken, account.accessTokenIv)
  } catch {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { connectionError: 'Failed to decrypt access token. Please reconnect.' },
    })
    return null
  }
}

export async function getAccountRefreshToken(accountId: string): Promise<string | null> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || !account.isActive || !account.refreshToken || !account.refreshTokenIv) {
    return null
  }

  try {
    return decryptSecret(account.refreshToken, account.refreshTokenIv)
  } catch {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { connectionError: 'Failed to decrypt refresh token. Please reconnect.' },
    })
    return null
  }
}

/**
 * Store/update a social account with encrypted tokens
 */
export async function upsertSocialAccount(params: {
  platform: SocialMediaPlatform
  accountId: string
  accountName: string
  accountHandle?: string
  profileImageUrl?: string
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
  scopes: string[]
  connectedById?: string
}) {
  const { encryptedValue: accessToken, iv: accessTokenIv } = encryptSecret(params.accessToken)

  let refreshToken: string | undefined
  let refreshTokenIv: string | undefined

  if (params.refreshToken) {
    const encrypted = encryptSecret(params.refreshToken)
    refreshToken = encrypted.encryptedValue
    refreshTokenIv = encrypted.iv
  }

  return prisma.socialAccount.upsert({
    where: {
      platform_accountId: {
        platform: params.platform,
        accountId: params.accountId,
      },
    },
    create: {
      platform: params.platform,
      accountId: params.accountId,
      accountName: params.accountName,
      accountHandle: params.accountHandle ?? null,
      profileImageUrl: params.profileImageUrl ?? null,
      accessToken,
      accessTokenIv,
      refreshToken: refreshToken ?? null,
      refreshTokenIv: refreshTokenIv ?? null,
      tokenExpiresAt: params.tokenExpiresAt ?? null,
      scopes: params.scopes,
      isActive: true,
      lastVerifiedAt: new Date(),
      connectionError: null,
      connectedById: params.connectedById ?? null,
    },
    update: {
      accountName: params.accountName,
      accountHandle: params.accountHandle ?? null,
      profileImageUrl: params.profileImageUrl ?? null,
      accessToken,
      accessTokenIv,
      refreshToken: refreshToken ?? null,
      refreshTokenIv: refreshTokenIv ?? null,
      tokenExpiresAt: params.tokenExpiresAt ?? null,
      scopes: params.scopes,
      isActive: true,
      lastVerifiedAt: new Date(),
      connectionError: null,
      connectedById: params.connectedById ?? null,
    },
  })
}

/**
 * Get all connected accounts, optionally filtered by platform
 */
export async function getConnectedAccounts(platform?: SocialMediaPlatform) {
  return prisma.socialAccount.findMany({
    where: {
      isActive: true,
      ...(platform ? { platform } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Disconnect (deactivate) a social account
 */
export async function disconnectAccount(accountId: string) {
  return prisma.socialAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  })
}

/**
 * Generate OAuth authorization URL for a platform
 */
export function getOAuthUrl(
  platform: SocialMediaPlatform,
  options: { state: string; codeChallenge?: string },
): string {
  const baseUrl = getSocialBaseUrl()
  const redirectUri = `${baseUrl}/api/social/oauth/callback`

  switch (platform) {
    case 'FACEBOOK':
    case 'INSTAGRAM': {
      const appId = getFacebookAppId()
      if (!appId) throw new Error('Facebook is not configured. Set FACEBOOK_APP_ID (or FACEBOOK_CLIENT_ID) on the server.')
      const scopes = FACEBOOK_OAUTH_SCOPES.join(',')
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(options.state)}&response_type=code`
    }
    case 'TWITTER': {
      const clientId = process.env.TWITTER_CLIENT_ID
      if (!clientId) throw new Error('X (Twitter) is not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET on the server.')
      if (!options.codeChallenge) throw new Error('Missing PKCE challenge')
      const scopes = 'tweet.read tweet.write users.read offline.access'
      return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(options.state)}&code_challenge=${options.codeChallenge}&code_challenge_method=S256`
    }
    case 'TIKTOK': {
      const clientKey = process.env.TIKTOK_CLIENT_KEY
      if (!clientKey) throw new Error('TikTok is not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET on the server (register a TikTok developer app at developers.tiktok.com).')
      const scopes = TIKTOK_OAUTH_SCOPES.join(',')
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(options.state)}`
    }
    case 'GOOGLE_MY_BUSINESS': {
      const clientId = process.env.GOOGLE_CLIENT_ID
      if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured')
      const scopes = 'https://www.googleapis.com/auth/business.manage'
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(options.state)}&response_type=code&access_type=offline&prompt=consent`
    }
    default:
      throw new Error(`OAuth not supported for platform: ${platform}`)
  }
}

/**
 * Refresh an OAuth access token for platforms that support refresh tokens.
 * Returns the new credentials, or null if the platform/token can't be refreshed.
 */
async function refreshPlatformToken(
  platform: SocialMediaPlatform,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number } | null> {
  switch (platform) {
    case 'TWITTER': {
      const clientId = process.env.TWITTER_CLIENT_ID
      const clientSecret = process.env.TWITTER_CLIENT_SECRET
      if (!clientId || !clientSecret) return null
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      const data = await res.json()
      if (data.error || !data.access_token) return null
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 7200,
      }
    }
    case 'TIKTOK': {
      const clientKey = process.env.TIKTOK_CLIENT_KEY
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET
      if (!clientKey || !clientSecret) return null
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      const data = await res.json()
      if (data.error || !data.access_token) return null
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 86400,
      }
    }
    case 'GOOGLE_MY_BUSINESS': {
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET
      if (!clientId || !clientSecret) return null
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      const data = await res.json()
      if (data.error || !data.access_token) return null
      // Google does not return a new refresh token on refresh — keep the old one.
      return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 }
    }
    default:
      // Facebook/Instagram use long-lived Page tokens that aren't refreshed
      // via a refresh_token grant; the user re-connects when they expire.
      return null
  }
}

/**
 * Get a usable access token for an account, transparently refreshing it first
 * if it's expired (or about to expire) and the platform supports refresh.
 * This is what the publisher should call so posts don't fail on stale tokens.
 */
export async function getValidAccessToken(accountId: string): Promise<string | null> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } })
  if (!account || !account.isActive) return null

  const expiresSoon =
    account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (expiresSoon && account.refreshToken && account.refreshTokenIv) {
    try {
      const refreshTokenValue = decryptSecret(account.refreshToken, account.refreshTokenIv)
      const refreshed = await refreshPlatformToken(account.platform, refreshTokenValue)
      if (refreshed) {
        const { encryptedValue, iv } = encryptSecret(refreshed.accessToken)
        let newRefreshToken = account.refreshToken
        let newRefreshTokenIv = account.refreshTokenIv
        if (refreshed.refreshToken) {
          const enc = encryptSecret(refreshed.refreshToken)
          newRefreshToken = enc.encryptedValue
          newRefreshTokenIv = enc.iv
        }
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: {
            accessToken: encryptedValue,
            accessTokenIv: iv,
            refreshToken: newRefreshToken,
            refreshTokenIv: newRefreshTokenIv,
            tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
            connectionError: null,
            lastVerifiedAt: new Date(),
          },
        })
        return refreshed.accessToken
      }
    } catch {
      // Fall through to returning the existing (possibly stale) token below.
    }
  }

  return getAccountAccessToken(accountId)
}

export function getExpectedAccountPlatformForShop(shopPlatform: ShopPlatform): SocialMediaPlatform {
  switch (shopPlatform) {
    case 'FACEBOOK_SHOP':
    case 'FACEBOOK_MARKETPLACE':
      return 'FACEBOOK'
    case 'TIKTOK_SHOP':
      return 'TIKTOK'
  }
}
