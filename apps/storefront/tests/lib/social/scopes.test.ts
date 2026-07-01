import { describe, expect, it } from 'vitest'
import {
  FACEBOOK_OAUTH_SCOPES,
  FACEBOOK_PAGE_SCOPES,
  INSTAGRAM_SCOPES,
  filterGrantedScopes,
} from '@/lib/social/scopes'

describe('lib/social/scopes', () => {
  it('requests only review-free scopes (posting/Instagram scopes trigger Meta "Invalid Scopes" pre-review)', () => {
    // Requesting these before App Review makes Meta reject the whole authorize
    // request, blocking the connect. They are re-added once App Review is done.
    expect(FACEBOOK_OAUTH_SCOPES).not.toContain('instagram_basic')
    expect(FACEBOOK_OAUTH_SCOPES).not.toContain('instagram_content_publish')
    expect(FACEBOOK_OAUTH_SCOPES).not.toContain('instagram_manage_insights')
    expect(FACEBOOK_OAUTH_SCOPES).not.toContain('pages_manage_posts')
  })

  it('requests the review-free subset of the page scopes', () => {
    expect(FACEBOOK_OAUTH_SCOPES).toEqual(
      FACEBOOK_PAGE_SCOPES.filter((scope) => scope !== 'pages_manage_posts'),
    )
  })

  it('filterGrantedScopes keeps only granted scopes, preserving request order', () => {
    const granted = ['pages_read_engagement', 'pages_show_list', 'unrelated_scope']
    expect(filterGrantedScopes(FACEBOOK_OAUTH_SCOPES, granted)).toEqual([
      'pages_show_list',
      'pages_read_engagement',
    ])
  })

  it('filterGrantedScopes returns nothing when the user granted nothing', () => {
    expect(filterGrantedScopes(INSTAGRAM_SCOPES, [])).toEqual([])
  })

  it('filterGrantedScopes never invents scopes the user did not grant', () => {
    const granted = ['instagram_basic']
    const result = filterGrantedScopes(INSTAGRAM_SCOPES, granted)
    expect(result).toEqual(['instagram_basic'])
    expect(result).not.toContain('instagram_content_publish')
  })
})
