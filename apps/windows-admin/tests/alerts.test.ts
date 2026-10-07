import { describe, expect, it } from 'vitest'
import { isRepeat, parseAlert, parseBadge, parseLabelUrl } from '../src/shared/alerts'

const ENDPOINT = 'https://www.josemadridsalsa.com/admin-desktop'
const PAGE = 'https://www.josemadridsalsa.com/admin-desktop?section=orders'

describe('parseAlert', () => {
  it('accepts a shell notification and resolves where a click goes', () => {
    expect(
      parseAlert(ENDPOINT, PAGE, { title: 'New order to fulfil', body: '3 waiting', path: '/admin-desktop?section=orders' }),
    ).toEqual({
      title: 'New order to fulfil',
      body: '3 waiting',
      url: 'https://www.josemadridsalsa.com/admin-desktop?section=orders',
    })
  })

  it('ignores a page that is not the admin server', () => {
    expect(
      parseAlert(ENDPOINT, 'https://accounts.google.com/signin', { title: 'x', path: '/admin-desktop?section=orders' }),
    ).toBeNull()
  })

  it('never sends a click outside the shell', () => {
    for (const path of ['https://evil.example/admin-desktop?x', '//evil.example/admin-desktop?x', '/admin/users', '/admin-desktop']) {
      expect(parseAlert(ENDPOINT, PAGE, { title: 'x', path })).toBeNull()
    }
  })

  it('clips text it did not write', () => {
    const alert = parseAlert(ENDPOINT, PAGE, { title: 'x'.repeat(500), body: 'y'.repeat(500), path: '/admin-desktop?section=messages' })
    expect(alert?.title).toHaveLength(120)
    expect(alert?.body).toHaveLength(240)
  })
})

describe('parseBadge', () => {
  it('takes a whole count from the admin page only', () => {
    expect(parseBadge(ENDPOINT, PAGE, 4)).toBe(4)
    expect(parseBadge(ENDPOINT, PAGE, 0)).toBe(0)
    expect(parseBadge(ENDPOINT, PAGE, 1.5)).toBeNull()
    expect(parseBadge(ENDPOINT, PAGE, -1)).toBeNull()
    expect(parseBadge(ENDPOINT, 'https://github.com/login', 4)).toBeNull()
  })
})

describe('isRepeat', () => {
  it('shows the same alert once across windows, then again after a while', () => {
    const seen = new Map<string, number>()
    const alert = { title: 'New order to fulfil', body: '3 waiting', url: PAGE }
    expect(isRepeat(seen, alert, 0)).toBe(false)
    expect(isRepeat(seen, alert, 1_000)).toBe(true)
    expect(isRepeat(seen, alert, 200_000)).toBe(false)
  })
})

describe('parseLabelUrl', () => {
  it('takes an https label from the admin page, wherever the carrier hosts it', () => {
    expect(parseLabelUrl(ENDPOINT, PAGE, 'https://easypost-files.s3.amazonaws.com/files/postage_label/x.png')).toBe(
      'https://easypost-files.s3.amazonaws.com/files/postage_label/x.png',
    )
  })

  it('refuses anything else', () => {
    for (const value of ['http://example.com/x.png', 'file:///C:/Windows/x.png', 'javascript:alert(1)', 42, 'not a url']) {
      expect(parseLabelUrl(ENDPOINT, PAGE, value)).toBeNull()
    }
    expect(parseLabelUrl(ENDPOINT, 'https://accounts.google.com/', 'https://x.example/label.png')).toBeNull()
  })
})
