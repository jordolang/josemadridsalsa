/**
 * Meta (Facebook + Instagram) OAuth scopes — single source of truth.
 *
 * Instagram publishing has no OAuth of its own; it rides on Facebook Login. So
 * the Facebook authorize dialog requests every scope below, and the linked
 * Instagram Business account is discovered afterwards through the Graph API.
 *
 * Which of these Meta actually GRANTS depends on the connecting account's role
 * on the Meta app and on Meta App Review:
 *   - Development mode: users who are Admins/Developers/Testers of the app are
 *     granted all of these without App Review — enough to publish to the
 *     business's own Page and its linked Instagram account.
 *   - Live mode: the posting/Instagram scopes require Meta App Review before
 *     they are granted to users who don't have a role on the app.
 *
 * We record only the scopes Meta reports as granted (see {@link filterGrantedScopes}),
 * so a connected account never claims a permission it doesn't actually hold.
 */

/** Facebook Page permissions needed to read and publish Page content. */
export const FACEBOOK_PAGE_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_metadata',
  'business_management',
  'catalog_management',
] as const

/** Instagram permissions needed to discover the account and publish to it. */
export const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
] as const

/**
 * Everything the Facebook authorize dialog asks for. Instagram scopes are
 * included here because Instagram is connected through Facebook Login — without
 * `instagram_basic` the linked Instagram account can't even be discovered.
 */
export const FACEBOOK_OAUTH_SCOPES: string[] = [
  ...FACEBOOK_PAGE_SCOPES,
  ...INSTAGRAM_SCOPES,
]

/**
 * Keep only the requested scopes Meta actually granted. Used when recording a
 * connected account's scopes so the UI and publisher never assume a permission
 * the user declined or that App Review hasn't approved. Order follows `requested`.
 */
export function filterGrantedScopes(
  requested: readonly string[],
  granted: readonly string[],
): string[] {
  const grantedSet = new Set(granted)
  return requested.filter((scope) => grantedSet.has(scope))
}
