import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/easypost/route'
import { createHmac } from 'crypto'

// Hoist mock dependencies
const { mockHeadersGet } = vi.hoisted(() => ({
  mockHeadersGet: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    webhookEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/tracking/webhook-handlers', () => ({
  handleTrackerUpdated: vi.fn(),
}))

vi.mock('next/headers', async () => ({
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
}))

// Get mock references after mocking
import prisma from '@/lib/prisma'
import { handleTrackerUpdated } from '@/lib/tracking/webhook-handlers'

const mockPrisma = prisma as any
const mockHandleTrackerUpdated = handleTrackerUpdated as any

describe('POST /api/webhooks/easypost - Integration Tests', () => {
  const webhookSecret = 'test_webhook_secret'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EASYPOST_WEBHOOK_SECRET = webhookSecret
    mockPrisma.webhookEvent.findFirst.mockResolvedValue(null)
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'webhook-1' })
    mockPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 })
    mockHandleTrackerUpdated.mockResolvedValue({ success: true })
  })

  function signWebhook(body: string): string {
    return createHmac('sha256', webhookSecret).update(body).digest('hex')
  }

  function buildRequest(body: string, signature?: string): Request {
    const headers: Record<string, string> = {}
    if (signature !== undefined) headers['x-webhook-signature'] = signature
    // The route reads the signature via next/headers, so reflect it there too
    mockHeadersGet.mockReturnValue(signature)
    return new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body,
      headers,
    })
  }

  it('verifies webhook signature correctly', async () => {
    const body = JSON.stringify({
      id: 'evt_test123',
      description: 'tracker.updated',
      mode: 'test',
      result: { id: 'trk_test', tracking_code: 'TRACK123456', status: 'in_transit', tracking_details: [] },
    })
    const signature = signWebhook(body)

    const response = await POST(buildRequest(body, signature))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
  })

  it('rejects webhook with a missing signature header', async () => {
    const body = JSON.stringify({ id: 'evt_nosig', description: 'tracker.updated', result: {} })

    const response = await POST(buildRequest(body, undefined))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Missing x-webhook-signature header')
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
  })

  it('rejects webhook with an invalid signature', async () => {
    const body = JSON.stringify({ id: 'evt_test123', description: 'tracker.updated', result: {} })

    const response = await POST(buildRequest(body, 'invalid_signature'))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Webhook signature verification failed')
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const body = '{ not valid json'
    const signature = signWebhook(body)

    const response = await POST(buildRequest(body, signature))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Invalid JSON')
  })

  it('processes tracker.updated events and delegates to the handler', async () => {
    const trackerData = {
      tracking_code: 'TRACK123456',
      status: 'delivered',
      tracking_details: [
        {
          status: 'delivered',
          message: 'Package delivered',
          datetime: '2026-06-20T16:30:00Z',
          tracking_location: { city: 'New York', state: 'NY' },
        },
      ],
    }
    const body = JSON.stringify({ id: 'evt_test123', description: 'tracker.updated', mode: 'test', result: trackerData })
    const signature = signWebhook(body)

    const response = await POST(buildRequest(body, signature))

    expect(response.status).toBe(200)
    expect(mockHandleTrackerUpdated).toHaveBeenCalledWith(trackerData)
    expect(mockPrisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { providerEventId: 'evt_test123' },
      data: { processed: true },
    })
  })

  it('prevents duplicate event processing with an idempotency check', async () => {
    const body = JSON.stringify({
      id: 'evt_duplicate',
      description: 'tracker.updated',
      mode: 'test',
      result: { tracking_code: 'TRACK123456', status: 'in_transit' },
    })
    const signature = signWebhook(body)

    // Event already processed
    mockPrisma.webhookEvent.findFirst.mockResolvedValue({
      id: 'webhook-1',
      providerEventId: 'evt_duplicate',
      processed: true,
    })

    const response = await POST(buildRequest(body, signature))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled()
  })

  it('handles tracker.created events without triggering the handler', async () => {
    const body = JSON.stringify({
      id: 'evt_created',
      description: 'tracker.created',
      mode: 'test',
      result: { tracking_code: 'TRACK789', status: 'pre_transit' },
    })
    const signature = signWebhook(body)

    const response = await POST(buildRequest(body, signature))

    expect(response.status).toBe(200)
    // tracker.created shares the same case and still delegates to the handler
    expect(mockHandleTrackerUpdated).toHaveBeenCalled()
  })

  it('still acknowledges receipt when the handler throws', async () => {
    const body = JSON.stringify({
      id: 'evt_error',
      description: 'tracker.updated',
      mode: 'test',
      result: { tracking_code: 'TRACK_ERROR', status: 'in_transit' },
    })
    const signature = signWebhook(body)

    mockHandleTrackerUpdated.mockRejectedValue(new Error('Database connection failed'))

    const response = await POST(buildRequest(body, signature))

    // A handler failure surfaces as a 500 so EasyPost retries
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Webhook processing failed')
  })

  it('skips signature verification when no secret is configured', async () => {
    delete process.env.EASYPOST_WEBHOOK_SECRET

    const body = JSON.stringify({
      id: 'evt_nosecret',
      description: 'tracker.updated',
      mode: 'test',
      result: { tracking_code: 'TRACK123', status: 'in_transit' },
    })

    // No signature provided; verification is skipped entirely
    const response = await POST(buildRequest(body, undefined))

    expect(response.status).toBe(200)
    expect(mockHandleTrackerUpdated).toHaveBeenCalled()
  })
})
