import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { POST } from '@/app/api/checkout/bigcommerce/route'
import { FundraiserStoreUnavailableError, resolveFundraiserStore } from '@/lib/fundraising/store.server'
import fixtures from '../lib/bigcommerce/fixtures.json'

vi.mock('@/lib/fundraising/store.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fundraising/store.server')>()),
  resolveFundraiserStore: vi.fn(),
}))

const API = 'https://api.bigcommerce.com/stores/testhash'
const [originalHot, , greenApple] = fixtures

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/checkout/bigcommerce', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  )

describe('POST /api/checkout/bigcommerce', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', 'bigcommerce')
    vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
    vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(resolveFundraiserStore).mockReset().mockResolvedValue(null)
    server.use(
      http.get(`${API}/v3/catalog/products`, () =>
        HttpResponse.json({
          data: [originalHot, greenApple],
          meta: { pagination: { current_page: 1, total_pages: 1 } },
        }),
      ),
    )
  })
  afterEach(() => vi.unstubAllEnvs())

  it('is closed until the storefront is switched to BigCommerce', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', '')
    expect((await post({ items: [{ slug: 'original-hot', quantity: 1 }] })).status).toBe(404)
  })

  it('rejects malformed carts', async () => {
    expect((await post({ items: [] })).status).toBe(400)
    expect((await post({ items: [{ slug: 'original-hot', quantity: 0 }] })).status).toBe(400)
  })

  it('returns the BigCommerce checkout URL', async () => {
    server.use(
      http.post(`${API}/v3/carts`, () =>
        HttpResponse.json({ data: { id: 'cart-1', redirect_urls: { checkout_url: 'https://checkout.example/cart-1' } } }),
      ),
    )

    const res = await post({ items: [{ slug: 'original-hot', quantity: 2 }] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ checkoutUrl: 'https://checkout.example/cart-1' })
  })

  it('tells the shopper what BigCommerce cannot sell', async () => {
    const res = await post({ items: [{ slug: '/green-apple/', quantity: 1 }] })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Green Apple is out of stock.' })
  })

  it('passes BigCommerce cart rejections through to the shopper', async () => {
    server.use(
      http.post(`${API}/v3/carts`, () =>
        HttpResponse.json({ status: 422, title: 'Not enough stock' }, { status: 422 }),
      ),
    )
    const res = await post({ items: [{ slug: 'original-hot', quantity: 1 }] })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Not enough stock' })
  })

  it('hides BigCommerce outages behind a retry message', async () => {
    server.use(http.post(`${API}/v3/carts`, () => HttpResponse.json({ title: 'Boom' }, { status: 500 })))
    const res = await post({ items: [{ slug: 'original-hot', quantity: 1 }] })
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/try again/)
  })

  it('keeps a cart a referral turns into a fundraiser sale on the site checkout', async () => {
    vi.mocked(resolveFundraiserStore).mockResolvedValue({} as Awaited<ReturnType<typeof resolveFundraiserStore>>)
    const res = await post({ items: [{ slug: 'original-hot', quantity: 1 }], referralCode: 'MAYA-123' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ siteCheckout: true })
    expect(resolveFundraiserStore).toHaveBeenCalledWith({ referralCode: 'MAYA-123' })
  })

  it('sends a referral for a closed campaign to BigCommerce as retail', async () => {
    server.use(
      http.post(`${API}/v3/carts`, () =>
        HttpResponse.json({ data: { id: 'cart-1', redirect_urls: { checkout_url: 'https://checkout.example/cart-1' } } }),
      ),
    )
    const res = await post({ items: [{ slug: 'original-hot', quantity: 1 }], referralCode: 'OLD-CODE' })
    expect(await res.json()).toEqual({ checkoutUrl: 'https://checkout.example/cart-1' })
  })

  it('refuses to guess when the fundraiser lookup fails', async () => {
    vi.mocked(resolveFundraiserStore).mockRejectedValue(new FundraiserStoreUnavailableError())
    const res = await post({ items: [{ slug: 'original-hot', quantity: 1 }], referralCode: 'MAYA-123' })
    expect(res.status).toBe(503)
  })
})
