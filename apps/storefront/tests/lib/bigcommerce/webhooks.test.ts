import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { http, HttpResponse } from 'msw'
import { revalidateTag } from 'next/cache'
import { mirrorBigCommerceOrder } from '@/lib/bigcommerce/orders'
import { server } from '@/tests/mocks/server'
import { POST } from '@/app/api/webhooks/bigcommerce/route'
import {
  BIGCOMMERCE_WEBHOOK_SECRET_HEADER,
  bigCommerceWebhookDestination,
  ensureBigCommerceWebhooks,
  isValidBigCommerceWebhookSecret,
} from '@/lib/bigcommerce/webhooks'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // Outside a request there is no `after` queue; run the work inline.
  after: (fn: () => unknown) => fn(),
}))
vi.mock('@/lib/bigcommerce/orders', () => ({ mirrorBigCommerceOrder: vi.fn() }))

const API = 'https://api.bigcommerce.com/stores/testhash'
const DESTINATION = 'https://www.josemadridsalsa.com/api/webhooks/bigcommerce'

beforeEach(() => {
  vi.stubEnv('BIGCOMMERCE_WEBHOOK_SECRET', 'hook-secret')
  vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
  vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
  vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
  vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
  vi.mocked(revalidateTag).mockReset()
})
afterEach(() => vi.unstubAllEnvs())

describe('isValidBigCommerceWebhookSecret', () => {
  it('accepts only the configured secret', () => {
    expect(isValidBigCommerceWebhookSecret('hook-secret')).toBe(true)
    expect(isValidBigCommerceWebhookSecret('hook-secreT')).toBe(false)
    expect(isValidBigCommerceWebhookSecret('short')).toBe(false)
    expect(isValidBigCommerceWebhookSecret(null)).toBe(false)
  })

  it('refuses everything when no secret is configured', () => {
    vi.stubEnv('BIGCOMMERCE_WEBHOOK_SECRET', '')
    expect(isValidBigCommerceWebhookSecret('')).toBe(false)
    expect(isValidBigCommerceWebhookSecret('anything')).toBe(false)
  })
})

describe('POST /api/webhooks/bigcommerce', () => {
  const deliver = (body: unknown, secret: string | null = 'hook-secret', query = '') =>
    POST(
      new NextRequest(`http://localhost/api/webhooks/bigcommerce${query}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { [BIGCOMMERCE_WEBHOOK_SECRET_HEADER]: secret } : {}),
        },
      }),
    )

  it('drops the catalog cache on a product change', async () => {
    const res = await deliver({ scope: 'store/product/updated', data: { type: 'product', id: 98 } })
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('bigcommerce:catalog', 'max')
  })

  it('copies the order into this site on an order change, without touching the catalog cache', async () => {
    vi.mocked(mirrorBigCommerceOrder).mockReset().mockResolvedValue({ action: 'created', orderId: 'o-1' })
    const res = await deliver({ scope: 'store/order/statusUpdated', data: { type: 'order', id: 9595 } })

    expect(res.status).toBe(200)
    expect(mirrorBigCommerceOrder).toHaveBeenCalledWith(9595)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('still acknowledges an order change whose copy fails, leaving it to the hourly sweep', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(mirrorBigCommerceOrder).mockReset().mockRejectedValue(new Error('BigCommerce down'))
    expect((await deliver({ scope: 'store/order/created', data: { id: 1 } })).status).toBe(200)
  })

  it('acknowledges other scopes without doing anything', async () => {
    vi.mocked(mirrorBigCommerceOrder).mockReset()
    expect((await deliver({ scope: 'store/customer/created', data: { id: 5 } })).status).toBe(200)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(mirrorBigCommerceOrder).not.toHaveBeenCalled()
  })

  it('rejects calls without the secret header', async () => {
    expect((await deliver({ scope: 'store/product/updated' }, null)).status).toBe(401)
    expect((await deliver({ scope: 'store/product/updated' }, 'wrong')).status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects malformed payloads', async () => {
    expect((await deliver({ nope: true })).status).toBe(400)
  })

  it('copies a fundraising-store order from the fundraising store', async () => {
    vi.mocked(mirrorBigCommerceOrder).mockReset().mockResolvedValue({ action: 'created', orderId: 'o-f1' })
    const res = await deliver({ scope: 'store/order/created', data: { id: 4821 } }, 'hook-secret', '?store=fundraising')

    expect(res.status).toBe(200)
    expect(mirrorBigCommerceOrder).toHaveBeenCalledWith(4821, { store: 'fundraising' })
  })

  it('still requires the secret on fundraising-store deliveries, and refuses an unknown store', async () => {
    vi.mocked(mirrorBigCommerceOrder).mockReset()
    const order = { scope: 'store/order/created', data: { id: 1 } }
    expect((await deliver(order, null, '?store=fundraising')).status).toBe(401)
    expect((await deliver(order, 'hook-secret', '?store=elsewhere')).status).toBe(400)
    expect(mirrorBigCommerceOrder).not.toHaveBeenCalled()
  })
})

describe('bigCommerceWebhookDestination', () => {
  it('names the store on the fundraising store\'s hooks only', () => {
    expect(bigCommerceWebhookDestination('https://www.josemadridsalsa.com/')).toBe(DESTINATION)
    expect(bigCommerceWebhookDestination('https://www.josemadridsalsa.com', 'fundraising')).toBe(
      `${DESTINATION}?store=fundraising`,
    )
  })
})

describe('ensureBigCommerceWebhooks', () => {
  it('creates missing hooks with the secret header', async () => {
    let created: unknown = null
    server.use(
      http.get(`${API}/v3/hooks`, () =>
        HttpResponse.json({
          data: [{ id: 1, scope: 'store/product/*', destination: 'https://elsewhere.example/hook', is_active: true }],
        }),
      ),
      http.post(`${API}/v3/hooks`, async ({ request }) => {
        created = await request.json()
        return HttpResponse.json({ data: { id: 2 } })
      }),
    )

    await expect(ensureBigCommerceWebhooks(DESTINATION)).resolves.toEqual([
      { scope: 'store/product/*', action: 'created' },
      { scope: 'store/order/*', action: 'created' },
    ])
    expect(created).toEqual({
      scope: 'store/order/*',
      destination: DESTINATION,
      is_active: true,
      headers: { [BIGCOMMERCE_WEBHOOK_SECRET_HEADER]: 'hook-secret' },
    })
  })

  it('reactivates a hook BigCommerce disabled and leaves active ones alone', async () => {
    let updatedPath: string | null = null
    server.use(
      http.get(`${API}/v3/hooks`, () =>
        HttpResponse.json({
          data: [
            { id: 7, scope: 'store/product/*', destination: DESTINATION, is_active: false },
            { id: 8, scope: 'store/order/*', destination: DESTINATION, is_active: true },
          ],
        }),
      ),
      http.put(`${API}/v3/hooks/:id`, ({ params }) => {
        updatedPath = String(params.id)
        return HttpResponse.json({ data: { id: 7 } })
      }),
    )
    await expect(ensureBigCommerceWebhooks(DESTINATION)).resolves.toEqual([
      { scope: 'store/product/*', action: 'reactivated' },
      { scope: 'store/order/*', action: 'unchanged' },
    ])
    expect(updatedPath).toBe('7')

    server.use(
      http.get(`${API}/v3/hooks`, () =>
        HttpResponse.json({
          data: [
            { id: 7, scope: 'store/product/*', destination: DESTINATION, is_active: true },
            { id: 8, scope: 'store/order/*', destination: DESTINATION, is_active: true },
          ],
        }),
      ),
    )
    await expect(ensureBigCommerceWebhooks(DESTINATION)).resolves.toEqual([
      { scope: 'store/product/*', action: 'unchanged' },
      { scope: 'store/order/*', action: 'unchanged' },
    ])
  })

  it('registers the fundraising store\'s hooks through its own API account', async () => {
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_STORE_HASH', 'fundhash')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_ACCESS_TOKEN', 'fund-token')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_ID', 'fund-client')
    vi.stubEnv('BIGCOMMERCE_FUNDRAISING_CLIENT_SECRET', 'fund-secret')
    const destination = bigCommerceWebhookDestination('https://www.josemadridsalsa.com', 'fundraising')
    const created: unknown[] = []
    server.use(
      http.get('https://api.bigcommerce.com/stores/fundhash/v3/hooks', () => HttpResponse.json({ data: [] })),
      http.post('https://api.bigcommerce.com/stores/fundhash/v3/hooks', async ({ request }) => {
        created.push(await request.json())
        return HttpResponse.json({ data: { id: 3 } })
      }),
    )

    await ensureBigCommerceWebhooks(destination, 'fundraising')

    expect(created).toHaveLength(2)
    expect(created[1]).toMatchObject({ scope: 'store/order/*', destination })
  })

  it('refuses to register without a secret', async () => {
    vi.stubEnv('BIGCOMMERCE_WEBHOOK_SECRET', '')
    await expect(ensureBigCommerceWebhooks(DESTINATION)).rejects.toThrow('BIGCOMMERCE_WEBHOOK_SECRET')
  })
})
