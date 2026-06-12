import type { SocialMediaPlatform } from '@prisma/client'
import type { PlatformConfigStatus, SocialCredentialProvider } from '@/types/social'
import { getSocialBaseUrl, platformToProvider } from './platforms'
import { getProviderCredentials } from './credentials'

/**
 * Single source of truth for "is this platform actually wired up?".
 *
 * The whole point of this module is HONESTY: the admin panel reads from here
 * so it can show a real "Configured / Setup required" state instead of
 * pretending every platform is ready. A platform is only "configured" when the
 * credentials it needs are actually present on the server.
 */

export type PlatformSetup = {
  platform: SocialMediaPlatform
  label: string
  /** Credential provider powering this platform. */
  provider: SocialCredentialProvider
  /** Env var names a power user could set instead of using the admin form. */
  requiredEnv: string[]
  /** Where the owner registers the developer app (one-time). */
  devConsoleUrl: string
  /** Plain-English, non-developer setup steps. */
  steps: string[]
  /** Extra note about review/approval gates the platform imposes. */
  note?: string
  /** Set when this platform reuses another platform's credentials. */
  sharesCredentialsWith?: SocialMediaPlatform
}

export const PLATFORM_SETUP: Record<SocialMediaPlatform, PlatformSetup> = {
  FACEBOOK: {
    platform: 'FACEBOOK',
    label: 'Facebook',
    provider: 'facebook',
    requiredEnv: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    devConsoleUrl: 'https://developers.facebook.com/apps',
    steps: [
      'Go to developers.facebook.com and create an app of type "Business".',
      'In the app, add the "Facebook Login" product.',
      'Paste the Redirect URI shown below into Facebook Login → Settings → Valid OAuth Redirect URIs.',
      'Copy the App ID and App Secret into FACEBOOK_APP_ID and FACEBOOK_APP_SECRET on the server.',
      'Make sure you are an admin of the Facebook Business Page you want to post to.',
      'Switch the app from Development to Live mode (toggle at the top of the app dashboard).',
    ],
    note: 'In Development mode, anyone without a role on the app sees "App not active" when connecting. If that error appears even for the app admin, Meta has deactivated the app — check the app dashboard for alerts (Data Use Checkup, business verification). Posting to a Page also needs the pages_manage_posts permission approved via Meta App Review before non-admins can use it.',
  },
  INSTAGRAM: {
    platform: 'INSTAGRAM',
    label: 'Instagram',
    provider: 'facebook',
    sharesCredentialsWith: 'FACEBOOK',
    requiredEnv: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    devConsoleUrl: 'https://developers.facebook.com/apps',
    steps: [
      'Instagram uses the same Facebook app — no separate credentials needed.',
      'Convert your Instagram account to a Business or Creator account.',
      'Link that Instagram account to your Facebook Page (Page Settings → Linked accounts).',
      'Connect Facebook here first; the linked Instagram account is detected automatically.',
    ],
    note: 'Requires instagram_content_publish, approved via Meta App Review for production use.',
  },
  TWITTER: {
    platform: 'TWITTER',
    label: 'X (Twitter)',
    provider: 'twitter',
    requiredEnv: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
    devConsoleUrl: 'https://developer.x.com/en/portal/dashboard',
    steps: [
      'Go to developer.x.com and create a Project + App.',
      'In the App, enable OAuth 2.0 and set the type to "Web App".',
      'Paste the Redirect URI shown below into the app\'s Callback URLs.',
      'Copy the OAuth 2.0 Client ID and Client Secret into TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET.',
      'Ensure the app has Read and Write permissions (needed to post tweets).',
    ],
  },
  TIKTOK: {
    platform: 'TIKTOK',
    label: 'TikTok',
    provider: 'tiktok',
    requiredEnv: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    devConsoleUrl: 'https://developers.tiktok.com/apps',
    steps: [
      'Go to developers.tiktok.com and create an app.',
      'Add the "Login Kit" and "Content Posting API" products to the app.',
      'Paste the Redirect URI shown below into the app\'s redirect URIs.',
      'Copy the Client Key and Client Secret into TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.',
    ],
    note: 'TikTok must approve Content Posting API access for your app before videos can go fully public.',
  },
  GOOGLE_MY_BUSINESS: {
    platform: 'GOOGLE_MY_BUSINESS',
    label: 'Google Business',
    provider: 'google',
    requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    devConsoleUrl: 'https://console.cloud.google.com/apis/credentials',
    steps: [
      'In Google Cloud Console, create OAuth 2.0 credentials (Web application).',
      'Paste the Redirect URI shown below into the Authorized redirect URIs.',
      'Copy the Client ID and Client Secret into GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      'Enable the "Business Profile API" for the project and request API access from Google.',
      'Make sure your Google account manages the Business Profile you want to post to.',
    ],
    note: 'Google gates the Business Profile API behind an access-request/quota approval — apply early, it can take time.',
  },
}

/** The exact OAuth redirect/callback URL platforms must be told to allow. */
export function getRedirectUri(): string {
  return `${getSocialBaseUrl()}/api/social/oauth/callback`
}

/**
 * Report, per platform, whether usable credentials exist — checking the
 * admin-entered values first, then env vars. Safe to call from a server
 * component; it never returns secret values, only presence + source.
 */
export async function getPlatformConfigStatus(): Promise<PlatformConfigStatus[]> {
  const redirectUri = getRedirectUri()

  // Resolve each distinct provider once, then map platforms onto it.
  const providers: SocialCredentialProvider[] = ['facebook', 'twitter', 'tiktok', 'google']
  const resolved = await Promise.all(
    providers.map(async (provider) => [provider, await getProviderCredentials(provider)] as const),
  )
  const credsByProvider = new Map(resolved)

  return (Object.keys(PLATFORM_SETUP) as SocialMediaPlatform[]).map((platform) => {
    const setup = PLATFORM_SETUP[platform]
    const provider = platformToProvider(platform)
    const creds = credsByProvider.get(provider) ?? null

    return {
      platform,
      label: setup.label,
      provider,
      configured: creds !== null,
      source: creds?.source ?? null,
      requiredEnv: setup.requiredEnv,
      devConsoleUrl: setup.devConsoleUrl,
      steps: setup.steps,
      note: setup.note,
      redirectUri,
      sharesCredentialsWith: setup.sharesCredentialsWith,
    }
  })
}
