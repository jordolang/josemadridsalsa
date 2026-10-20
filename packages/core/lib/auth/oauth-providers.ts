/** OAuth providers the sign-in pages can offer, in the order their buttons appear. */
export const OAUTH_PROVIDER_IDS = ['google', 'github', 'facebook', 'apple'] as const

export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number]

const ENV_PREFIX: Record<OAuthProviderId, string> = {
  google: 'GOOGLE',
  github: 'GITHUB',
  facebook: 'FACEBOOK',
  apple: 'APPLE',
}

/**
 * The OAuth providers whose client id and secret are both set.
 *
 * A provider registered without them fails only when someone clicks its button
 * ("client_id is required"), and NextAuth then sends them back to the sign-in
 * page, so the button looks like it does nothing. Leaving it out hides the button.
 */
export function getConfiguredOAuthProviders(
  env: Record<string, string | undefined> = process.env
): OAuthProviderId[] {
  return OAUTH_PROVIDER_IDS.filter((id) => {
    const prefix = ENV_PREFIX[id]
    return Boolean(env[`${prefix}_CLIENT_ID`]?.trim() && env[`${prefix}_CLIENT_SECRET`]?.trim())
  })
}

const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: 'We could not start that sign-in. Try another option, or sign in with your email.',
  OAuthCallback: 'That sign-in did not finish. Try again, or sign in with your email.',
  OAuthCreateAccount: 'We could not create an account from that sign-in. Try signing in with your email.',
  Callback: 'That sign-in did not finish. Try again, or sign in with your email.',
  OAuthAccountNotLinked: 'This email already has an account. Sign in the way you first signed up.',
  AccessDenied: 'You do not have permission to sign in.',
  Configuration: 'Sign-in is not set up correctly. Please try again later.',
  SessionRequired: 'Please sign in to continue.',
  CredentialsSignin: 'Invalid email or password. Please try again.',
}

/** The message to show for the `error` query param NextAuth adds when it returns to the sign-in page. */
export function getSignInErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return SIGN_IN_ERROR_MESSAGES[code] ?? 'Sign in failed. Please try again.'
}
