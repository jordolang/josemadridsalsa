import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
  getEmailBaseUrl,
  verifyUnsubscribeToken,
} from '@/lib/email/unsubscribe-url'

/**
 * The footer link every transactional email ships. The audit flagged it pointing at
 * `/account/preferences`, a route that does not exist and returned a 404 — a compliance and
 * deliverability problem. These tests pin the link to the working `/unsubscribe` flow.
 */

describe('buildUnsubscribeUrl', () => {
  it('points at the standalone /unsubscribe flow, not the missing preferences page', () => {
    const url = buildUnsubscribeUrl('customer@example.com')
    expect(url).toContain('/unsubscribe?email=')
    expect(url).not.toContain('/account/preferences')
  })

  it('resolves to a route that actually exists on disk', () => {
    // The reason the link 404'd: nothing rendered `/account/preferences`. Assert the target the
    // link now uses is a real page, and that the old target is still absent.
    const appDir = join(__dirname, '..', '..', '..', 'app', '(public)')
    expect(existsSync(join(appDir, 'unsubscribe', 'page.tsx'))).toBe(true)
    expect(existsSync(join(appDir, 'account', 'preferences'))).toBe(false)
  })

  it('url-encodes the recipient so plus-addressed and special-character emails survive', () => {
    const url = buildUnsubscribeUrl('test+special@example.com')
    expect(url).toContain(`email=${encodeURIComponent('test+special@example.com')}`)
    expect(url).not.toContain('test+special@example.com')
  })

  it('carries a token the /unsubscribe route accepts, so the page loads real preferences', () => {
    // Without a valid token the route returns blank defaults, and saving the form would wipe any
    // prior category opt-outs. The tokenized link avoids that silent re-subscribe.
    const email = 'donor@example.com'
    const url = new URL(buildUnsubscribeUrl(email))
    const token = url.searchParams.get('token')
    expect(token).toBeTruthy()
    expect(verifyUnsubscribeToken(email, token!)).toBe(true)
  })

  it('builds the link on the same base host as the List-Unsubscribe header', () => {
    expect(buildUnsubscribeUrl('a@b.com').startsWith(`${getEmailBaseUrl()}/unsubscribe`)).toBe(true)
  })
})

describe('generateUnsubscribeToken', () => {
  it('is deterministic for an address and rejects a token minted for a different one', () => {
    expect(generateUnsubscribeToken('a@example.com')).toBe(generateUnsubscribeToken('A@example.com'))
    expect(verifyUnsubscribeToken('a@example.com', generateUnsubscribeToken('b@example.com'))).toBe(
      false
    )
  })
})
