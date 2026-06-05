import type { ShopPlatform, SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { getProviderCredentials, type SocialProvider } from './credentials'

/** Map a publishing platform to the credential provider that powers it. */
export function platformToProvider(platform: SocialMediaPlatform): SocialProvider {
  switch (platform) {
    case 'FACEBOOK':
    case 'INSTAGRAM':
      return 'facebook'
    case 'TWITTER':
      return 'twitter'
    case 'TIKTOK':
      return 'tiktok'
    case 'GOOGLE_MY_BUSINESS':
      return 'google'
  }
}

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
 * Generate OAuth authorization URL for a platform. Credentials are resolved
 * from the admin panel first, then env vars, so connecting works as soon as the
 * owner saves keys in the UI — no redeploy needed.
 */
export async function getOAuthUrl(
  platform: SocialMediaPlatform,
  options: { state: string; codeChallenge?: string },
): Promise<string> {
  const baseUrl = getSocialBaseUrl()
  const redirectUri = `${baseUrl}/api/social/oauth/callback`
  const creds = await getProviderCredentials(platformToProvider(platform))

  switch (platform) {
    case 'FACEBOOK':
    case 'INSTAGRAM': {
      if (!creds) throw new Error('Facebook is not configured. Add your Facebook App ID and Secret in the admin panel (Social → Accounts → Facebook → Show setup steps).')
      const scopes = FACEBOOK_OAUTH_SCOPES.join(',')
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${creds.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(options.state)}&response_type=code`
    }
    case 'TWITTER': {
      if (!creds) throw new Error('X (Twitter) is not configured. Add your Client ID and Secret in the admin panel (Social → Accounts → X → Show setup steps).')
      if (!options.codeChallenge) throw new Error('Missing PKCE challenge')
      const scopes = 'tweet.read tweet.write users.read offline.access'
      return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${creds.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(options.state)}&code_challenge=${options.codeChallenge}&code_challenge_method=S256`
    }
    case 'TIKTOK': {
      if (!creds) throw new Error('TikTok is not configured. Add your Client Key and Secret in the admin panel (Social → Accounts → TikTok → Show setup steps).')
      const scopes = TIKTOK_OAUTH_SCOPES.join(',')
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${creds.clientId}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(options.state)}`
    }
    case 'GOOGLE_MY_BUSINESS': {
      if (!creds) throw new Error('Google Business is not configured. Add your Google Client ID and Secret in the admin panel (Social → Accounts → Google Business → Show setup steps).')
      const scopes = 'https://www.googleapis.com/auth/business.manage'
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${creds.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(options.state)}&response_type=code&access_type=offline&prompt=consent`
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
      const creds = await getProviderCredentials('twitter')
      if (!creds) return null
      const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')
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
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.access_token) return null
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 7200,
      }
    }
    case 'TIKTOK': {
      const creds = await getProviderCredentials('tiktok')
      if (!creds) return null
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: creds.clientId,
          client_secret: creds.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error || !data?.access_token) return null
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 86400,
      }
    }
    case 'GOOGLE_MY_BUSINESS': {
      const creds = await getProviderCredentials('google')
      if (!creds) return null
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.access_token) return null
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
