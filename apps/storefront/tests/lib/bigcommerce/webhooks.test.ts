import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { http, HttpResponse } from 'msw'
import { revalidateTag } from 'next/cache'
import { server } from '@/tests/mocks/server'
import { POST } from '@/app/api/webhooks/bigcommerce/route'
import {
  BIGCOMMERCE_WEBHOOK_SECRET_HEADER,
  ensureBigCommerceWebhooks,
  isValidBigCommerceWebhookSecret,
} from '@/lib/bigcommerce/webhooks'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

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
  const deliver = (body: unknown, secret: string | null = 'hook-secret') =>
    POST(
      new NextRequest('http://localhost/api/webhooks/bigcommerce', {
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

  it('acknowledges other scopes without touching the cache', async () => {
    expect((await deliver({ scope: 'store/order/created' })).status).toBe(200)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects calls without the secret header', async () => {
    expect((await deliver({ scope: 'store/product/updated' }, null)).status).toBe(401)
    expect((await deliver({ scope: 'store/product/updated' }, 'wrong')).status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects malformed payloads', async () => {
    expect((await deliver({ nope: true })).status).toBe(400)
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
    ])
    expect(created).toEqual({
      scope: 'store/product/*',
      destination: DESTINATION,
      is_active: true,
      headers: { [BIGCOMMERCE_WEBHOOK_SECRET_HEADER]: 'hook-secret' },
    })
  })

  it('reactivates a hook BigCommerce disabled and leaves active ones alone', async () => {
    let updatedPath: string | null = null
    server.use(
      http.get(`${API}/v3/hooks`, () =>
        HttpResponse.json({ data: [{ id: 7, scope: 'store/product/*', destination: DESTINATION, is_active: false }] }),
      ),
      http.put(`${API}/v3/hooks/:id`, ({ params }) => {
        updatedPath = String(params.id)
        return HttpResponse.json({ data: { id: 7 } })
      }),
    )
    await expect(ensureBigCommerceWebhooks(DESTINATION)).resolves.toEqual([
      { scope: 'store/product/*', action: 'reactivated' },
    ])
    expect(updatedPath).toBe('7')

    server.use(
      http.get(`${API}/v3/hooks`, () =>
        HttpResponse.json({ data: [{ id: 7, scope: 'store/product/*', destination: DESTINATION, is_active: true }] }),
      ),
    )
    await expect(ensureBigCommerceWebhooks(DESTINATION)).resolves.toEqual([
      { scope: 'store/product/*', action: 'unchanged' },
    ])
  })

  it('refuses to register without a secret', async () => {
    vi.stubEnv('BIGCOMMERCE_WEBHOOK_SECRET', '')
    await expect(ensureBigCommerceWebhooks(DESTINATION)).rejects.toThrow('BIGCOMMERCE_WEBHOOK_SECRET')
  })
})
