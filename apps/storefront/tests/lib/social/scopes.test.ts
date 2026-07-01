import { describe, expect, it } from 'vitest'
import {
  FACEBOOK_OAUTH_SCOPES,
  FACEBOOK_PAGE_SCOPES,
  INSTAGRAM_SCOPES,
  filterGrantedScopes,
} from '@/lib/social/scopes'

describe('lib/social/scopes', () => {
  it('requests the Instagram + posting scopes (regression: they were stripped, breaking IG connect)', () => {
    // Without these in the Facebook authorize request, the linked Instagram
    // account is never discovered and Instagram can never be selected to post.
    expect(FACEBOOK_OAUTH_SCOPES).toContain('instagram_basic')
    expect(FACEBOOK_OAUTH_SCOPES).toContain('instagram_content_publish')
    expect(FACEBOOK_OAUTH_SCOPES).toContain('instagram_manage_insights')
    expect(FACEBOOK_OAUTH_SCOPES).toContain('pages_manage_posts')
  })

  it('composes the request from the page + instagram subsets', () => {
    expect(FACEBOOK_OAUTH_SCOPES).toEqual([...FACEBOOK_PAGE_SCOPES, ...INSTAGRAM_SCOPES])
  })

  it('filterGrantedScopes keeps only granted scopes, preserving request order', () => {
    const granted = ['instagram_content_publish', 'pages_show_list', 'unrelated_scope']
    expect(filterGrantedScopes(FACEBOOK_OAUTH_SCOPES, granted)).toEqual([
      'pages_show_list',
      'instagram_content_publish',
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
