import { NextResponse } from 'next/server'
import { SocialMediaPlatform } from '@prisma/client'
import {
  createCodeChallenge,
  createCodeVerifier,
  createOAuthState,
  getSocialOAuthCookieOptions,
  serializeSocialOAuthSession,
  SOCIAL_OAUTH_COOKIE_NAME,
} from '@/lib/social/oauth'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getOAuthUrl } from '@/lib/social/platforms'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') as SocialMediaPlatform | null

  if (!platform) {
    return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
  }

  const validPlatforms: SocialMediaPlatform[] = ['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'TIKTOK', 'GOOGLE_MY_BUSINESS']
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  try {
    const state = createOAuthState()
    const codeVerifier = platform === SocialMediaPlatform.TWITTER ? createCodeVerifier() : undefined
    const oauthUrl = getOAuthUrl(platform, {
      state,
      codeChallenge: codeVerifier ? createCodeChallenge(codeVerifier) : undefined,
    })

    const response = NextResponse.json({ url: oauthUrl })
    response.cookies.set(
      SOCIAL_OAUTH_COOKIE_NAME,
      serializeSocialOAuthSession({
        state,
        platform,
        userId: user.id,
        codeVerifier,
        createdAt: Date.now(),
      }),
      getSocialOAuthCookieOptions(),
    )

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate OAuth URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
