import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BigCommerceNotice, bigCommerceAdminUrl } from '@/components/admin/BigCommerceNotice'

function enableStorefront() {
  vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', 'bigcommerce')
  vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'dsk4gx4')
  vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
  vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
  vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
}

afterEach(() => vi.unstubAllEnvs())

describe('BigCommerceNotice', () => {
  it('renders nothing until the storefront sells through BigCommerce', () => {
    const { container } = render(<BigCommerceNotice area="products" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says what moved and links to that screen in the BigCommerce admin', () => {
    enableStorefront()
    render(<BigCommerceNotice area="orders" />)

    expect(screen.getByText('Managed in BigCommerce')).toBeInTheDocument()
    expect(screen.getByText(/Retail orders are placed, paid and fulfilled in BigCommerce/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open orders in BigCommerce/ })).toHaveAttribute(
      'href',
      'https://store-dsk4gx4.mybigcommerce.com/manage/orders',
    )
  })

  it('keeps content editing here on the products page', () => {
    enableStorefront()
    render(<BigCommerceNotice area="products" />)
    expect(screen.getByText(/Photos, heat level, nutrition, ingredients and descriptions are still edited here/)).toBeInTheDocument()
  })

  it('builds control-panel URLs from the store hash', () => {
    expect(bigCommerceAdminUrl('abc123', 'customers')).toBe('https://store-abc123.mybigcommerce.com/manage/customers')
  })
})
