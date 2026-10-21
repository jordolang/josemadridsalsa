import { describe, expect, it } from 'vitest'
import { getConfiguredOAuthProviders, getSignInErrorMessage } from '@/lib/auth/oauth-providers'

describe('getConfiguredOAuthProviders', () => {
  it('leaves out a provider with no client id, which fails with "client_id is required" when clicked', () => {
    expect(getConfiguredOAuthProviders({ GOOGLE_CLIENT_SECRET: 'x', GITHUB_CLIENT_ID: 'a', GITHUB_CLIENT_SECRET: 'b' })).toEqual(['github'])
  })

  it('leaves out a provider with a blank client id or a missing client secret', () => {
    expect(getConfiguredOAuthProviders({ GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: 'x', APPLE_CLIENT_ID: 'a' })).toEqual([])
  })

  it('keeps every provider that has both, in button order', () => {
    const env = Object.fromEntries(
      ['APPLE', 'FACEBOOK', 'GITHUB', 'GOOGLE'].flatMap((p) => [[`${p}_CLIENT_ID`, 'id'], [`${p}_CLIENT_SECRET`, 'value']])
    )
    expect(getConfiguredOAuthProviders(env)).toEqual(['google', 'github', 'facebook', 'apple'])
  })
})

describe('getSignInErrorMessage', () => {
  it('says nothing when sign-in did not fail', () => {
    expect(getSignInErrorMessage(null)).toBeNull()
    expect(getSignInErrorMessage('')).toBeNull()
  })

  it('explains a failed social sign-in', () => {
    expect(getSignInErrorMessage('OAuthCallback')).toMatch(/did not finish/)
  })

  it('falls back to a general message for an unknown code', () => {
    expect(getSignInErrorMessage('Whatever')).toBe('Sign in failed. Please try again.')
  })
})
