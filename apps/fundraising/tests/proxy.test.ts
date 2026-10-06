import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import proxy from '@/proxy'

describe('old /fundraising-site paths', () => {
  it('redirects to the same page without the prefix, query intact', () => {
    const response = proxy(new NextRequest('https://fundraising.josemadrid.net/fundraising-site/shop?a=b'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://fundraising.josemadrid.net/shop?a=b')
  })

  it('sends the bare prefix to the home page', () => {
    const response = proxy(new NextRequest('https://fundraising.josemadrid.net/fundraising-site'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://fundraising.josemadrid.net/')
  })

  it('does not redirect lookalike paths', () => {
    const response = proxy(new NextRequest('https://fundraising.josemadrid.net/fundraising-sites'))

    expect(response.headers.get('location')).toBeNull()
  })
})

describe('fundraiser pages', () => {
  it.each(['/fundraising', '/fundraisers/lincoln-band', '/fundraise/school', '/f/lincoln', '/arena/week', '/fundraiser-portal/dashboard'])(
    'serves %s here rather than redirecting it',
    (path) => {
      const response = proxy(new NextRequest(`https://fundraising.josemadrid.net${path}`))

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    }
  )

  it('forwards the pathname on the request for the portal layout', () => {
    const response = proxy(new NextRequest('https://fundraising.josemadrid.net/fundraiser-portal/team'))

    expect(response.headers.get('x-middleware-request-x-pathname')).toBe('/fundraiser-portal/team')
  })
})
