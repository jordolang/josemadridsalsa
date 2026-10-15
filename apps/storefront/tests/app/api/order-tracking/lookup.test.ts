import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetIn: 600, current: 1 })),
  createRateLimitHeaders: vi.fn(() => ({})),
  getClientIdentifier: vi.fn(() => '127.0.0.1'),
  RATE_LIMITS: { API_GENERAL: { maxRequests: 100, windowSeconds: 60 } },
}))

vi.mock('@/lib/order-tracking/load', () => ({
  findOrderForLookup: vi.fn(),
  findOrderByTrackingNumber: vi.fn(),
}))

import { POST } from '@/app/api/order-tracking/lookup/route'
import { checkRateLimit } from '@/lib/rate-limiter'
import { findOrderByTrackingNumber, findOrderForLookup } from '@/lib/order-tracking/load'
import { verifyOrderAccessToken } from '@/lib/orders/access-token'

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/order-tracking/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

const order = {
  id: 'order-1',
  orderNumber: 'JMS-1001',
  guestPhone: null,
  user: null,
  shippingAddress: { phone: '(740) 555-1234' },
  billingAddress: null,
}

describe('POST /api/order-tracking/lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = 'test-secret'
  })

  it('returns a token-gated link when the phone matches the order', async () => {
    vi.mocked(findOrderForLookup).mockResolvedValue(order as never)

    const response = await post({ method: 'order', orderNumber: 'jms-1001', phone: '740.555.1234' })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(findOrderForLookup).toHaveBeenCalledWith('JMS-1001')
    const url = new URL(body.url, 'http://localhost')
    expect(url.pathname).toBe('/order-tracking/JMS-1001')
    expect(verifyOrderAccessToken('order-1', url.searchParams.get('token'))).toBe(true)
  })

  it('gives the same answer for a wrong phone as for a missing order', async () => {
    vi.mocked(findOrderForLookup).mockResolvedValueOnce(order as never)
    const wrongPhone = await post({ method: 'order', orderNumber: 'JMS-1001', phone: '740-555-0000' })

    vi.mocked(findOrderForLookup).mockResolvedValueOnce(null)
    const missing = await post({ method: 'order', orderNumber: 'JMS-9999', phone: '740-555-1234' })

    expect(wrongPhone.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await wrongPhone.json()).toEqual(await missing.json())
  })

  it('sends a tracking-number lookup to the shipment-only page', async () => {
    vi.mocked(findOrderByTrackingNumber).mockResolvedValue({ id: 'order-1' } as never)

    const response = await post({ method: 'tracking', trackingNumber: '9400 1000 0000' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: '/track/940010000000' })
  })

  it('404s an unknown tracking number', async () => {
    vi.mocked(findOrderByTrackingNumber).mockResolvedValue(null)
    const response = await post({ method: 'tracking', trackingNumber: '9400100000000' })
    expect(response.status).toBe(404)
  })

  it('rejects invalid input before touching the database', async () => {
    const response = await post({ method: 'order', orderNumber: '', phone: '' })
    expect(response.status).toBe(400)
    expect(findOrderForLookup).not.toHaveBeenCalled()
  })

  it('stops guessing once the rate limit is hit', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetIn: 300, current: 11 })
    const response = await post({ method: 'order', orderNumber: 'JMS-1001', phone: '7405551234' })
    expect(response.status).toBe(429)
    expect(findOrderForLookup).not.toHaveBeenCalled()
  })
})
