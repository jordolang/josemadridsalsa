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

const TIKTOK_SCOPES = ['user.info.basic', 'video.publish', 'video.upload']
const TWITTER_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/business.manage']

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

async function exchangeTikTokToken(code: string, redirectUri: string) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET

  if (!clientKey || !clientSecret) throw new Error('TikTok app not configured')

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  const tokenData = await tokenRes.json()
  if (tokenData.error) throw new Error(tokenData.error_description || 'TikTok token exchange failed')

  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username',
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  )
  const userData = await userRes.json()

  return {
    accessToken: tokenData.access_token as string,
    refreshToken: tokenData.refresh_token as string | undefined,
    expiresIn: tokenData.expires_in ?? 86400,
    openId: (tokenData.open_id as string | undefined) ?? userData.data?.user?.open_id,
    user: userData.data?.user as {
      open_id: string
      display_name: string
      avatar_url?: string
      username?: string
    } | undefined,
  }
}

async function exchangeGoogleToken(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.')
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokenData = await tokenRes.json()
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error)

  const accessToken = tokenData.access_token as string

  // Discover the Business Profile accounts this user manages.
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const accountsData = await accountsRes.json()
  if (accountsData.error) throw new Error(accountsData.error.message || 'Failed to list Google Business accounts')

  const gbAccounts = (accountsData.accounts ?? []) as Array<{ name: string; accountName?: string }>
  if (!gbAccounts.length) {
    throw new Error('No Google Business accounts found for this Google login.')
  }

  // Each location becomes its own connectable target. The localPosts API needs
  // the full "accounts/{id}/locations/{id}" resource name, so we build it here.
  const locations: Array<{ resourceName: string; title: string }> = []
  for (const account of gbAccounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const locData = await locRes.json()
    for (const loc of (locData.locations ?? []) as Array<{ name: string; title?: string }>) {
      // loc.name is "locations/456"; prefix with the account to get the full path.
      locations.push({
        resourceName: `${account.name}/${loc.name}`,
        title: loc.title || account.accountName || 'Google Business Location',
      })
    }
  }

  if (!locations.length) {
    throw new Error('No Google Business locations found. Add a verified location first.')
  }

  return {
    accessToken,
    refreshToken: tokenData.refresh_token as string | undefined,
    expiresIn: tokenData.expires_in ?? 3600,
    locations,
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
        const ttData = await exchangeTikTokToken(code, redirectUri)

        if (!ttData.openId) {
          throw new Error('TikTok did not return an account identifier.')
        }

        await upsertSocialAccount({
          platform: 'TIKTOK',
          accountId: ttData.openId,
          accountName: ttData.user?.display_name ?? 'TikTok User',
          accountHandle: ttData.user?.username ? `@${ttData.user.username}` : undefined,
          profileImageUrl: ttData.user?.avatar_url ?? undefined,
          accessToken: ttData.accessToken,
          refreshToken: ttData.refreshToken,
          tokenExpiresAt: new Date(Date.now() + ttData.expiresIn * 1000),
          scopes: TIKTOK_SCOPES,
          connectedById: user.id,
        })

        await logAudit({
          userId: user.id,
          action: 'social_account.connect',
          entityType: 'SocialAccount',
          changes: { platform: 'TIKTOK' },
        })
        break
      }

      case 'GOOGLE_MY_BUSINESS': {
        const gData = await exchangeGoogleToken(code, redirectUri)

        for (const location of gData.locations) {
          await upsertSocialAccount({
            platform: 'GOOGLE_MY_BUSINESS',
            accountId: location.resourceName,
            accountName: location.title,
            accessToken: gData.accessToken,
            refreshToken: gData.refreshToken,
            tokenExpiresAt: new Date(Date.now() + gData.expiresIn * 1000),
            scopes: GOOGLE_SCOPES,
            connectedById: user.id,
          })
        }

        await logAudit({
          userId: user.id,
          action: 'social_account.connect',
          entityType: 'SocialAccount',
          changes: { platform: 'GOOGLE_MY_BUSINESS', locations: gData.locations.length },
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
