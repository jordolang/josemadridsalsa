import type { SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

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
export function getOAuthUrl(platform: SocialMediaPlatform): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/social/oauth/callback`

  switch (platform) {
    case 'FACEBOOK':
    case 'INSTAGRAM': {
      const appId = process.env.FACEBOOK_APP_ID
      if (!appId) throw new Error('FACEBOOK_APP_ID not configured')
      const scopes = [
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_show_list',
        'pages_read_user_content',
        'pages_manage_metadata',
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights',
      ].join(',')
      const state = JSON.stringify({ platform, ts: Date.now() })
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`
    }
    case 'TWITTER': {
      const clientId = process.env.TWITTER_CLIENT_ID
      if (!clientId) throw new Error('TWITTER_CLIENT_ID not configured')
      const scopes = 'tweet.read tweet.write users.read offline.access'
      const state = JSON.stringify({ platform, ts: Date.now() })
      const codeChallenge = 'challenge' // In production, use PKCE
      return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&code_challenge=${codeChallenge}&code_challenge_method=plain`
    }
    case 'TIKTOK': {
      const clientKey = process.env.TIKTOK_CLIENT_KEY
      if (!clientKey) throw new Error('TIKTOK_CLIENT_KEY not configured')
      const scopes = 'user.info.basic,video.publish,video.upload'
      const state = JSON.stringify({ platform, ts: Date.now() })
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
    }
    case 'GOOGLE_MY_BUSINESS': {
      const clientId = process.env.GOOGLE_CLIENT_ID
      if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured')
      const scopes = 'https://www.googleapis.com/auth/business.manage'
      const state = JSON.stringify({ platform, ts: Date.now() })
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&response_type=code&access_type=offline&prompt=consent`
    }
    default:
      throw new Error(`OAuth not supported for platform: ${platform}`)
  }
}
