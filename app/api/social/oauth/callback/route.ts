import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { SocialMediaPlatform } from '@prisma/client'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import {
  getSocialOAuthCookieOptions,
  parseSocialOAuthSession,
  SOCIAL_OAUTH_COOKIE_NAME,
} from '@/lib/social/oauth'
import {
  getFacebookAppId,
  getFacebookAppSecret,
  getSocialBaseUrl,
  getTikTokShopAppSecret,
  upsertSocialAccount,
} from '@/lib/social/platforms'
import { logAudit } from '@/lib/audit'

const FACEBOOK_SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_show_list',
  'pages_manage_metadata',
  'catalog_management',
  'business_management',
]

const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
]

// Granted by the TikTok Shop authorization in partner.tiktokshop.com — recorded
// for visibility but not enforced here. The partner app config controls the
// actual permissions on the access token.
const TIKTOK_SHOP_SCOPES = ['product.management', 'order.management', 'fulfillment.management']
const TWITTER_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']

async function exchangeFacebookToken(code: string, redirectUri: string) {
  const appId = getFacebookAppId()
  const appSecret = getFacebookAppSecret()

  if (!appId || !appSecret) {
    throw new Error(
      'Facebook is not configured. Set FACEBOOK_APP_ID/FACEBOOK_APP_SECRET (or FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET) on the server.',
    )
  }

  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  )
  const tokenData = await tokenRes.json()
  if (tokenData.error) throw new Error(tokenData.error.message)

  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`,
  )
  const longData = await longRes.json()
  if (longData.error) throw new Error(longData.error.message)

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longData.access_token}&fields=id,name,access_token,picture,username`,
  )
  const pagesData = await pagesRes.json()

  if (!pagesData.data?.length) {
    throw new Error('No Facebook Pages found. Make sure you manage at least one Page.')
  }

  return {
    userToken: longData.access_token as string,
    expiresIn: longData.expires_in ?? 5184000,
    pages: pagesData.data as Array<{
      id: string
      name: string
      access_token: string
      picture?: { data?: { url?: string } }
      username?: string
    }>,
  }
}

async function exchangeTwitterToken(code: string, redirectUri: string, codeVerifier: string) {
  const clientId = process.env.TWITTER_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET

  if (!clientId || !clientSecret) throw new Error('Twitter app not configured')

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })
  const tokenData = await tokenRes.json()
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error)

  const userRes = await fetch(
    'https://api.x.com/2/users/me?user.fields=profile_image_url,username',
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  )
  const userData = await userRes.json()

  return {
    accessToken: tokenData.access_token as string,
    refreshToken: tokenData.refresh_token as string | undefined,
    expiresIn: tokenData.expires_in ?? 7200,
    user: userData.data as {
      id: string
      name: string
      username: string
      profile_image_url?: string
    },
  }
}

async function exchangeTikTokShopToken(code: string) {
  const appKey = (process.env.TIKTOK_SHOP_APP_KEY || process.env.TIKTOK_CLIENT_KEY)?.trim()
  const appSecret = getTikTokShopAppSecret()

  if (!appKey || !appSecret) {
    throw new Error(
      'TikTok Shop app not configured. Set TIKTOK_SHOP_APP_KEY and TIKTOK_SHOP_APP_SECRET on the server.',
    )
  }

  // TikTok Shop's auth/v2/token/get is GET-with-query-params (per partner
  // docs). The response wraps payload in { code, message, data }; code 0
  // means success, anything else is an error message we surface verbatim.
  const tokenUrl = new URL('https://auth.tiktok-shops.com/api/v2/token/get')
  tokenUrl.searchParams.set('app_key', appKey)
  tokenUrl.searchParams.set('app_secret', appSecret)
  tokenUrl.searchParams.set('auth_code', code)
  tokenUrl.searchParams.set('grant_type', 'authorized_code')

  const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' })
  const tokenJson = await tokenRes.json()

  if (tokenJson.code !== 0) {
    throw new Error(tokenJson.message || 'TikTok Shop token exchange failed')
  }

  const data = tokenJson.data ?? {}
  const expiresIn: number = data.access_token_expire_in ?? 86400

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresIn,
    openId: (data.open_id as string | undefined) ?? (data.seller_name as string | undefined),
    sellerName: (data.seller_name as string | undefined) ?? 'TikTok Shop',
    sellerRegion: data.seller_base_region as string | undefined,
  }
}

function redirectToAdmin(
  baseUrl: string,
  params: Record<string, string>,
  clearCookie = true,
) {
  const target = new URL('/admin/social', baseUrl)

  Object.entries(params).forEach(([key, value]) => {
    target.searchParams.set(key, value)
  })

  const response = NextResponse.redirect(target)

  if (clearCookie) {
    response.cookies.set(SOCIAL_OAUTH_COOKIE_NAME, '', {
      ...getSocialOAuthCookieOptions(),
      maxAge: 0,
    })
  }

  return response
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const baseUrl = getSocialBaseUrl()
  const redirectUri = `${baseUrl}/api/social/oauth/callback`

  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return redirectToAdmin(baseUrl, { error: 'unauthorized' })
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const cookieStore = await cookies()
  const oauthSession = parseSocialOAuthSession(
    cookieStore.get(SOCIAL_OAUTH_COOKIE_NAME)?.value,
  )

  if (error) {
    return redirectToAdmin(baseUrl, { error })
  }

  if (!code || !state || !oauthSession) {
    return redirectToAdmin(baseUrl, { error: 'missing_params' })
  }

  if (oauthSession.state !== state || oauthSession.userId !== user.id) {
    return redirectToAdmin(baseUrl, { error: 'invalid_state' })
  }

  const platform = oauthSession.platform

  try {
    switch (platform) {
      case 'FACEBOOK':
      case 'INSTAGRAM': {
        const fbData = await exchangeFacebookToken(code, redirectUri)
        let instagramAccounts = 0

        for (const page of fbData.pages) {
          await upsertSocialAccount({
            platform: 'FACEBOOK',
            accountId: page.id,
            accountName: page.name,
            accountHandle: page.username ?? undefined,
            profileImageUrl: page.picture?.data?.url ?? undefined,
            accessToken: page.access_token,
            refreshToken: fbData.userToken,
            tokenExpiresAt: new Date(Date.now() + fbData.expiresIn * 1000),
            scopes: FACEBOOK_SCOPES,
            connectedById: user.id,
          })

          try {
            const igRes = await fetch(
              `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${page.access_token}`,
            )
            const igData = await igRes.json()
            const igAccount = igData.instagram_business_account

            if (igAccount) {
              await upsertSocialAccount({
                platform: 'INSTAGRAM',
                accountId: igAccount.id,
                accountName: igAccount.name || page.name,
                accountHandle: igAccount.username ? `@${igAccount.username}` : undefined,
                profileImageUrl: igAccount.profile_picture_url ?? undefined,
                accessToken: page.access_token,
                refreshToken: fbData.userToken,
                tokenExpiresAt: new Date(Date.now() + fbData.expiresIn * 1000),
                scopes: INSTAGRAM_SCOPES,
                connectedById: user.id,
              })
              instagramAccounts++
            }
          } catch (igError) {
            console.warn(
              `[SOCIAL_OAUTH] Failed to discover Instagram account for page ${page.id}:`,
              igError,
            )
          }
        }

        await logAudit({
          userId: user.id,
          action: 'social_account.connect',
          entityType: 'SocialAccount',
          changes: {
            platform: 'FACEBOOK',
            pages: fbData.pages.length,
            instagramAccounts,
          },
        })
        break
      }

      case 'TWITTER': {
        if (!oauthSession.codeVerifier) {
          return redirectToAdmin(baseUrl, { error: 'missing_pkce_verifier' })
        }

        const twData = await exchangeTwitterToken(
          code,
          redirectUri,
          oauthSession.codeVerifier,
        )

        await upsertSocialAccount({
          platform: 'TWITTER',
          accountId: twData.user.id,
          accountName: twData.user.name,
          accountHandle: `@${twData.user.username}`,
          profileImageUrl: twData.user.profile_image_url ?? undefined,
          accessToken: twData.accessToken,
          refreshToken: twData.refreshToken,
          tokenExpiresAt: new Date(Date.now() + twData.expiresIn * 1000),
          scopes: TWITTER_SCOPES,
          connectedById: user.id,
        })

        await logAudit({
          userId: user.id,
          action: 'social_account.connect',
          entityType: 'SocialAccount',
          changes: { platform: 'TWITTER', handle: `@${twData.user.username}` },
        })
        break
      }

      case 'TIKTOK': {
        const ttData = await exchangeTikTokShopToken(code)

        if (!ttData.openId) {
          throw new Error('TikTok Shop did not return a seller identifier.')
        }

        await upsertSocialAccount({
          platform: 'TIKTOK',
          accountId: ttData.openId,
          accountName: ttData.sellerName,
          accountHandle: ttData.sellerRegion ? `[${ttData.sellerRegion}]` : undefined,
          accessToken: ttData.accessToken,
          refreshToken: ttData.refreshToken,
          tokenExpiresAt: new Date(Date.now() + ttData.expiresIn * 1000),
          scopes: TIKTOK_SHOP_SCOPES,
          connectedById: user.id,
        })

        await logAudit({
          userId: user.id,
          action: 'social_account.connect',
          entityType: 'SocialAccount',
          changes: { platform: 'TIKTOK', seller: ttData.sellerName, region: ttData.sellerRegion },
        })
        break
      }

      default:
        return redirectToAdmin(baseUrl, { error: 'unsupported_platform' })
    }

    return redirectToAdmin(baseUrl, { connected: platform.toLowerCase() })
  } catch (error) {
    console.error(`[SOCIAL_OAUTH_CALLBACK] ${platform}:`, error)
    const message = error instanceof Error ? error.message : 'Connection failed'
    return redirectToAdmin(baseUrl, { error: message })
  }
}
