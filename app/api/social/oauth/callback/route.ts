import { NextResponse } from 'next/server'
import type { SocialMediaPlatform } from '@prisma/client'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { upsertSocialAccount } from '@/lib/social/platforms'
import { logAudit } from '@/lib/audit'

async function exchangeFacebookToken(code: string, redirectUri: string) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) throw new Error('Facebook app not configured')

  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  )
  const tokenData = await tokenRes.json()
  if (tokenData.error) throw new Error(tokenData.error.message)

  // Exchange for long-lived token
  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`,
  )
  const longData = await longRes.json()
  if (longData.error) throw new Error(longData.error.message)

  // Get user's pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longData.access_token}&fields=id,name,access_token,picture,username`,
  )
  const pagesData = await pagesRes.json()

  if (!pagesData.data?.length) {
    throw new Error('No Facebook Pages found. Make sure you manage at least one Page.')
  }

  return {
    userToken: longData.access_token,
    expiresIn: longData.expires_in ?? 5184000, // ~60 days
    pages: pagesData.data as Array<{
      id: string
      name: string
      access_token: string
      picture?: { data?: { url?: string } }
      username?: string
    }>,
  }
}

async function exchangeTwitterToken(code: string, redirectUri: string) {
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
      code_verifier: 'challenge', // Must match PKCE
    }),
  })
  const tokenData = await tokenRes.json()
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error)

  // Get user info
  const userRes = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url,username', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userData = await userRes.json()

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
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

  // Get user info
  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username',
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  )
  const userData = await userRes.json()

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in ?? 86400,
    openId: tokenData.open_id,
    user: userData.data?.user as {
      open_id: string
      display_name: string
      avatar_url?: string
      username?: string
    } | undefined,
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/social/oauth/callback`

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/admin/social?error=unauthorized`)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${baseUrl}/admin/social?error=${encodeURIComponent(error)}`)
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${baseUrl}/admin/social?error=missing_params`)
  }

  let platform: SocialMediaPlatform
  try {
    const state = JSON.parse(stateRaw)
    platform = state.platform
  } catch {
    return NextResponse.redirect(`${baseUrl}/admin/social?error=invalid_state`)
  }

  try {
    switch (platform) {
      case 'FACEBOOK':
      case 'INSTAGRAM': {
        const fbData = await exchangeFacebookToken(code, redirectUri)

        // Connect first page (user can select later)
        for (const page of fbData.pages) {
          await upsertSocialAccount({
            platform: 'FACEBOOK',
            accountId: page.id,
            accountName: page.name,
            accountHandle: page.username ?? undefined,
            profileImageUrl: page.picture?.data?.url ?? undefined,
            accessToken: page.access_token,
            tokenExpiresAt: new Date(Date.now() + fbData.expiresIn * 1000),
            scopes: [
              'pages_manage_posts',
              'pages_read_engagement',
              'pages_show_list',
              'pages_read_user_content',
            ],
            connectedById: user.id,
          })
        }

        await logAudit({
          userId: user.id,
          action: 'social_account.connect',
          entityType: 'SocialAccount',
          changes: { platform: 'FACEBOOK', pages: fbData.pages.length },
        })
        break
      }

      case 'TWITTER': {
        const twData = await exchangeTwitterToken(code, redirectUri)

        await upsertSocialAccount({
          platform: 'TWITTER',
          accountId: twData.user.id,
          accountName: twData.user.name,
          accountHandle: `@${twData.user.username}`,
          profileImageUrl: twData.user.profile_image_url ?? undefined,
          accessToken: twData.accessToken,
          refreshToken: twData.refreshToken,
          tokenExpiresAt: new Date(Date.now() + twData.expiresIn * 1000),
          scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
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

        await upsertSocialAccount({
          platform: 'TIKTOK',
          accountId: ttData.openId,
          accountName: ttData.user?.display_name ?? 'TikTok User',
          accountHandle: ttData.user?.username ? `@${ttData.user.username}` : undefined,
          profileImageUrl: ttData.user?.avatar_url ?? undefined,
          accessToken: ttData.accessToken,
          refreshToken: ttData.refreshToken,
          tokenExpiresAt: new Date(Date.now() + ttData.expiresIn * 1000),
          scopes: ['user.info.basic', 'video.publish', 'video.upload'],
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

      default:
        return NextResponse.redirect(`${baseUrl}/admin/social?error=unsupported_platform`)
    }

    return NextResponse.redirect(`${baseUrl}/admin/social?connected=${platform.toLowerCase()}`)
  } catch (err) {
    console.error(`[SOCIAL_OAUTH_CALLBACK] ${platform}:`, err)
    const msg = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.redirect(`${baseUrl}/admin/social?error=${encodeURIComponent(msg)}`)
  }
}
