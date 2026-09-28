import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BigCommerceNotice, BigCommerceOrderNotice, bigCommerceAdminUrl } from '@/components/admin/BigCommerceNotice'

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

describe('BigCommerceOrderNotice', () => {
  it('links a fundraising-store copy to the order in the fundraising store', () => {
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_STORE_HASH', 'c034x363rd')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_SECRET', 'test-secret')
    render(<BigCommerceOrderNotice orderNumber="BCF-4821" />)

    expect(screen.getByRole('link', { name: /Open order #4821 in the BigCommerce fundraising store/ })).toHaveAttribute(
      'href',
      'https://store-c034x363rd.mybigcommerce.com/manage/orders/4821',
    )
  })

  it('links a retail copy to the main store', () => {
    enableStorefront()
    render(<BigCommerceOrderNotice orderNumber="BC-9595" />)
    expect(screen.getByRole('link', { name: /Open order #9595 in BigCommerce/ })).toHaveAttribute(
      'href',
      'https://store-dsk4gx4.mybigcommerce.com/manage/orders/9595',
    )
  })
})
