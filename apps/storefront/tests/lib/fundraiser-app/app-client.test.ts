/**
 * Pure helpers from the mobile app (`apps/fundraiser-app/src/lib`). The app has no test runner of
 * its own (adding one breaks the `npm ci` its EAS builds run), so they are covered here.
 */
import { describe, expect, it } from 'vitest'
import { joinImageUrl } from '../../../../fundraiser-app/src/lib/image-url'
import { mayHaveSaved } from '../../../../fundraiser-app/src/lib/save-outcome'

describe('joinImageUrl', () => {
  const base = 'https://www.josemadrid.net'

  it('prefixes a site path with the storefront address', () => {
    expect(joinImageUrl(base, '/images/new-products/mild.png')).toBe(
      'https://www.josemadrid.net/images/new-products/mild.png'
    )
  })

  it('adds the slash a relative path is missing', () => {
    expect(joinImageUrl(base, 'images/mild.png')).toBe('https://www.josemadrid.net/images/mild.png')
  })

  it('leaves an absolute URL alone', () => {
    expect(joinImageUrl(base, 'https://utfs.io/f/abc.png')).toBe('https://utfs.io/f/abc.png')
    expect(joinImageUrl(base, 'http://cdn.example.com/a.png')).toBe('http://cdn.example.com/a.png')
  })

  it('returns null when there is no photo', () => {
    expect(joinImageUrl(base, null)).toBeNull()
    expect(joinImageUrl(base, undefined)).toBeNull()
    expect(joinImageUrl(base, '')).toBeNull()
  })
})

describe('mayHaveSaved', () => {
  const failure = (status: number) => Object.assign(new Error('failed'), { status })

  it('treats no answer and server errors as possibly saved', () => {
    expect(mayHaveSaved(failure(0))).toBe(true)
    expect(mayHaveSaved(failure(500))).toBe(true)
    expect(mayHaveSaved(failure(503))).toBe(true)
    expect(mayHaveSaved(new TypeError('Network request failed'))).toBe(true)
    expect(mayHaveSaved(undefined)).toBe(true)
  })

  it('treats a refusal as not saved, so the cart stays editable', () => {
    expect(mayHaveSaved(failure(400))).toBe(false)
    expect(mayHaveSaved(failure(401))).toBe(false)
    expect(mayHaveSaved(failure(403))).toBe(false)
    expect(mayHaveSaved(failure(409))).toBe(false)
  })
})
