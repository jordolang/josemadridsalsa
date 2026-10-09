import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * The banner is for shoppers. On the admin it covered the bottom of every
 * page, including Print Packing Slip on an order, until it was dismissed.
 */

const pathname = vi.hoisted(() => ({ current: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

import { CookieConsentBanner } from '@/components/ui/cookie-consent-banner'

afterEach(() => {
  window.localStorage.clear()
})

describe('CookieConsentBanner', () => {
  it('asks shoppers on the storefront', async () => {
    pathname.current = '/products'
    render(<CookieConsentBanner />)
    expect(await screen.findByRole('dialog', { name: /cookie consent/i })).toBeInTheDocument()
  })

  it('stays out of the admin', () => {
    pathname.current = '/admin/orders/ord1'
    render(<CookieConsentBanner />)
    expect(screen.queryByRole('dialog', { name: /cookie consent/i })).toBeNull()
  })
})
