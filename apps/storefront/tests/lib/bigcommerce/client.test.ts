import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import {
  BigCommerceApiError,
  bigCommerceFetch,
  bigCommerceFetchAll,
  buildBigCommerceUrl,
} from '@/lib/bigcommerce/client'
import {
  BigCommerceConfigError,
  findBigCommerceStore,
  getBigCommerceStore,
} from '@/lib/bigcommerce/config'

const API = 'https://api.bigcommerce.com/stores/testhash'

function setMainStoreEnv() {
  vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
  vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
  vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
  vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
}

describe('BigCommerce config', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads each store from its own env prefix', () => {
    setMainStoreEnv()
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_STORE_HASH', 'fundhash')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_ACCESS_TOKEN', 'fund-token')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_ID', 'fund-client')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_SECRET', 'fund-secret')

    expect(getBigCommerceStore('main').storeHash).toBe('testhash')
    expect(getBigCommerceStore('fundraising')).toMatchObject({ storeHash: 'fundhash', accessToken: 'fund-token' })
  })

  it('names the missing variables when a store is not configured', () => {
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_STORE_HASH', 'fundhash')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_ACCESS_TOKEN', '  ')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_ID', '')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_SECRET', 'fund-secret')

    expect(findBigCommerceStore('fundraising')).toBeNull()
    expect(() => getBigCommerceStore('fundraising')).toThrow(BigCommerceConfigError)
    expect(() => getBigCommerceStore('fundraising')).toThrow(
      /BIGCOMMERCE_FUNDRAISING_ACCESS_TOKEN, BIGCOMMERCE_FUNDRAISING_CLIENT_ID/,
    )
  })
})

describe('bigCommerceFetch', () => {
  beforeEach(setMainStoreEnv)
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('builds store-scoped URLs and drops undefined query values', () => {
    expect(buildBigCommerceUrl('abc', '/v3/catalog/products', { page: 2, include: undefined })).toBe(
      'https://api.bigcommerce.com/stores/abc/v3/catalog/products?page=2',
    )
  })

  it('authenticates with the store token and sends JSON bodies', async () => {
    let seen: { token: string | null; contentType: string | null; body: unknown } | null = null
    server.use(
      http.post(`${API}/v3/carts`, async ({ request }) => {
        seen = {
          token: request.headers.get('X-Auth-Token'),
          contentType: request.headers.get('Content-Type'),
          body: await request.json(),
        }
        return HttpResponse.json({ data: { id: 'cart-1' } })
      }),
    )

    const res = await bigCommerceFetch<{ data: { id: string } }>('main', 'v3/carts', {
      method: 'POST',
      body: { line_items: [] },
    })

    expect(res.data.id).toBe('cart-1')
    expect(seen).toEqual({ token: 'test-token', contentType: 'application/json', body: { line_items: [] } })
  })

  it('resolves an empty 204 body to null', async () => {
    server.use(http.delete(`${API}/v3/carts/cart-1`, () => new HttpResponse(null, { status: 204 })))
    await expect(bigCommerceFetch('main', 'v3/carts/cart-1', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('surfaces v3 error titles and field errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.post(`${API}/v3/carts`, () =>
        HttpResponse.json(
          { status: 422, title: 'Missing or invalid data', errors: { line_items: 'Option Jar 2 is required' } },
          { status: 422 },
        ),
      ),
    )

    const error = await bigCommerceFetch('main', 'v3/carts', { method: 'POST', body: {} }).catch((e) => e)
    expect(error).toBeInstanceOf(BigCommerceApiError)
    expect(error.status).toBe(422)
    expect(error.message).toBe('Missing or invalid data: Option Jar 2 is required')
  })

  it('surfaces v2 error arrays', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.get(`${API}/v2/orders/9`, () =>
        HttpResponse.json([{ status: 404, message: 'The requested resource was not found.' }], { status: 404 }),
      ),
    )
    await expect(bigCommerceFetch('main', 'v2/orders/9')).rejects.toThrow('The requested resource was not found.')
  })

  it('waits out a 429 and retries', async () => {
    let calls = 0
    server.use(
      http.get(`${API}/v2/time`, () => {
        calls++
        return calls === 1
          ? new HttpResponse(null, { status: 429, headers: { 'X-Rate-Limit-Time-Reset-Ms': '5' } })
          : HttpResponse.json({ time: 1 })
      }),
    )

    await expect(bigCommerceFetch('main', 'v2/time')).resolves.toEqual({ time: 1 })
    expect(calls).toBe(2)
  })

  it('gives up after repeated 429s instead of looping forever', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let calls = 0
    server.use(
      http.get(`${API}/v2/time`, () => {
        calls++
        return new HttpResponse(null, { status: 429, headers: { 'X-Rate-Limit-Time-Reset-Ms': '1' } })
      }),
    )

    await expect(bigCommerceFetch('main', 'v2/time')).rejects.toMatchObject({ status: 429 })
    expect(calls).toBe(3)
  })
})

describe('bigCommerceFetchAll', () => {
  beforeEach(setMainStoreEnv)
  afterEach(() => vi.unstubAllEnvs())

  it('follows total_pages even when BigCommerce caps the page size', async () => {
    const pages: string[] = []
    server.use(
      http.get(`${API}/v3/catalog/products`, ({ request }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page'))
        pages.push(`${page}:${url.searchParams.get('limit')}:${url.searchParams.get('include')}`)
        return HttpResponse.json({
          data: [{ id: page * 10 }, { id: page * 10 + 1 }],
          meta: { pagination: { current_page: page, total_pages: 3 } },
        })
      }),
    )

    const items = await bigCommerceFetchAll<{ id: number }>('main', 'v3/catalog/products', {
      query: { include: 'images' },
    })

    expect(items.map((item) => item.id)).toEqual([10, 11, 20, 21, 30, 31])
    expect(pages).toEqual(['1:250:images', '2:250:images', '3:250:images'])
  })
})
