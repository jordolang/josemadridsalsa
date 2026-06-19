import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/easypost/route'
import { createHmac } from 'crypto'

// Mock dependencies
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockHandleTrackerUpdated = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    webhookEvent: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}))

vi.mock('@/lib/tracking/webhook-handlers', () => ({
  handleTrackerUpdated: mockHandleTrackerUpdated,
}))

const mockHeadersGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: () => ({
    get: mockHeadersGet,
  }),
}))

describe('POST /api/webhooks/easypost - Integration Tests', () => {
  const webhookSecret = 'test_webhook_secret'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EASYPOST_WEBHOOK_SECRET = webhookSecret
  })

  function signWebhook(body: string): string {
    return createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')
  }

  it('verifies webhook signature correctly', async () => {
    const webhookPayload = {
      id: 'evt_test123',
      description: 'tracker.updated',
      mode: 'test',
      result: {
        id: 'trk_test',
        tracking_code: 'TRACK123456',
        status: 'in_transit',
        tracking_details: [],
      },
    }

    const body = JSON.stringify(webhookPayload)
    const signature = signWebhook(body)

    mockHeadersGet.mockReturnValue(signature)
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: 'webhook-1',
      providerEventId: 'evt_test123',
      type: 'tracker.updated',
      processed: false,
      createdAt: new Date(),
    })
    mockHandleTrackerUpdated.mockResolvedValue(undefined)

    const request = new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body,
      headers: {
        'X-Easypost-Hmac-Signature': signature,
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
  })

  it('rejects webhook with invalid signature', async () => {
    const webhookPayload = {
      id: 'evt_test123',
      description: 'tracker.updated',
      result: {},
    }

    const body = JSON.stringify(webhookPayload)
    const invalidSignature = 'invalid_signature'

    mockHeadersGet.mockReturnValue(invalidSignature)

    const request = new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body,
      headers: {
        'X-Easypost-Hmac-Signature': invalidSignature,
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Invalid signature')
  })

  it('processes tracker.updated events', async () => {
    const trackerData = {
      tracking_code: 'TRACK123456',
      status: 'delivered',
      tracking_details: [
        {
          status: 'delivered',
          message: 'Package delivered',
          datetime: '2026-06-20T16:30:00Z',
          tracking_location: {
            city: 'New York',
            state: 'NY',
          },
        },
      ],
    }

    const webhookPayload = {
      id: 'evt_test123',
      description: 'tracker.updated',
      mode: 'test',
      result: trackerData,
    }

    const body = JSON.stringify(webhookPayload)
    const signature = signWebhook(body)

    mockHeadersGet.mockReturnValue(signature)
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: 'webhook-1',
      providerEventId: 'evt_test123',
      type: 'tracker.updated',
      processed: false,
      createdAt: new Date(),
    })
    mockHandleTrackerUpdated.mockResolvedValue(undefined)

    const request = new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body,
      headers: {
        'X-Easypost-Hmac-Signature': signature,
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockHandleTrackerUpdated).toHaveBeenCalledWith(trackerData)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { providerEventId: 'evt_test123' },
      data: { processed: true },
    })
  })

  it('prevents duplicate event processing with idempotency check', async () => {
    const webhookPayload = {
      id: 'evt_duplicate',
      description: 'tracker.updated',
      mode: 'test',
      result: {
        tracking_code: 'TRACK123456',
        status: 'in_transit',
      },
    }

    const body = JSON.stringify(webhookPayload)
    const signature = signWebhook(body)

    mockHeadersGet.mockReturnValue(signature)
    // Webhook event already exists
    mockFindUnique.mockResolvedValue({
      id: 'webhook-1',
      providerEventId: 'evt_duplicate',
      type: 'tracker.updated',
      processed: true,
      createdAt: new Date(),
    })

    const request = new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body,
      headers: {
        'X-Easypost-Hmac-Signature': signature,
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Should not process duplicate
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('handles tracker.created events', async () => {
    const webhookPayload = {
      id: 'evt_created',
      description: 'tracker.created',
      mode: 'test',
      result: {
        tracking_code: 'TRACK789',
        status: 'pre_transit',
      },
    }

    const body = JSON.stringify(webhookPayload)
    const signature = signWebhook(body)

    mockHeadersGet.mockReturnValue(signature)
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: 'webhook-1',
      providerEventId: 'evt_created',
      type: 'tracker.created',
      processed: false,
      createdAt: new Date(),
    })

    const request = new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body,
      headers: {
        'X-Easypost-Hmac-Signature': signature,
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    // tracker.created doesn't trigger email notifications
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
  })

  it('handles webhook processing errors gracefully', async () => {
    const webhookPayload = {
      id: 'evt_error',
      description: 'tracker.updated',
      mode: 'test',
      result: {
        tracking_code: 'TRACK_ERROR',
        status: 'in_transit',
      },
    }

    const body = JSON.stringify(webhookPayload)
    const signature = signWebhook(body)

    mockHeadersGet.mockReturnValue(signature)
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: 'webhook-1',
      providerEventId: 'evt_error',
      type: 'tracker.updated',
      processed: false,
      createdAt: new Date(),
    })

    // Simulate processing error
    mockHandleTrackerUpdated.mockRejectedValue(
      new Error('Database connection failed')
    )

    const request = new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body,
      headers: {
        'X-Easypost-Hmac-Signature': signature,
      },
    })

    const response = await POST(request)

    // Should still return 200 to acknowledge receipt
    expect(response.status).toBe(200)

    // Should mark as processed even if handler fails
    // (prevents infinite retry loops)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { providerEventId: 'evt_error' },
      data: { processed: true },
    })
  })

  it('returns 401 when webhook secret is not configured', async () => {
    delete process.env.EASYPOST_WEBHOOK_SECRET

    const webhookPayload = {
      id: 'evt_test',
      description: 'tracker.updated',
      result: {},
    }

    const request = new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
      headers: {
        'X-Easypost-Hmac-Signature': 'any_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('Webhook secret')
  })
})
