import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import proxy from '@/proxy'

const originalFundraisingOrigin = process.env.FUNDRAISING_APP_ORIGIN

afterEach(() => {
  if (originalFundraisingOrigin === undefined) {
    delete process.env.FUNDRAISING_APP_ORIGIN
  } else {
    process.env.FUNDRAISING_APP_ORIGIN = originalFundraisingOrigin
  }
})

describe('storefront fundraising boundary', () => {
  it('redirects fundraising pages to the fundraising application', () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = proxy(new NextRequest('https://store.example.com/fundraise/school?participant=abc'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://fundraising.example.com/fundraise/school?participant=abc',
    )
  })

  it('does not redirect main storefront pages', () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = proxy(new NextRequest('https://store.example.com/products'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not redirect requests already on the fundraising origin', () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = proxy(new NextRequest('https://fundraising.example.com/fundraising'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not redirect a fundraising rewrite forwarded from the fundraising origin', () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = proxy(
      new NextRequest('https://store.example.com/fundraising', {
        headers: {
          'x-forwarded-host': 'fundraising.example.com',
        },
      }),
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
