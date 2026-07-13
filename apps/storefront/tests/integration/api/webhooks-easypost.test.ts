import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/easypost/route'

// The route verifies + parses the body via EasyPost's Utils.validateWebhook,
// reached through getEasyPostClient(). Mock that to control verification.
const { mockValidateWebhook } = vi.hoisted(() => ({ mockValidateWebhook: vi.fn() }))

vi.mock('@/lib/shipping-api', () => ({
  getEasyPostClient: vi.fn(() => ({
    Utils: { validateWebhook: mockValidateWebhook },
  })),
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

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-hmac-signature': 'hmac-sha256-hex=test' })),
}))

import prisma from '@/lib/prisma'
import { handleTrackerUpdated } from '@/lib/tracking/webhook-handlers'

const mockPrisma = prisma as any
const mockHandleTrackerUpdated = handleTrackerUpdated as any

describe('POST /api/webhooks/easypost - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EASYPOST_WEBHOOK_SECRET = 'test_webhook_secret'
    mockPrisma.webhookEvent.findFirst.mockResolvedValue(null)
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'webhook-1' })
    mockPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 })
    mockHandleTrackerUpdated.mockResolvedValue({ success: true })
  })

  function buildRequest(body: unknown): Request {
    return new Request('http://localhost:3000/api/webhooks/easypost', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  }

  it('processes a verified tracker.updated event and delegates to the handler', async () => {
    const trackerData = {
      tracking_code: 'TRACK123456',
      status: 'delivered',
      tracking_details: [
        { status: 'delivered', message: 'Delivered', datetime: '2026-06-20T16:30:00Z' },
      ],
    }
    mockValidateWebhook.mockReturnValue({
      id: 'evt_test123',
      description: 'tracker.updated',
      result: trackerData,
    })

    const response = await POST(buildRequest({}))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(mockHandleTrackerUpdated).toHaveBeenCalledWith(trackerData)
    expect(mockPrisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { providerEventId: 'evt_test123' },
      data: { processed: true },
    })
  })

  it('returns 400 when the signature cannot be verified', async () => {
    mockValidateWebhook.mockImplementation(() => {
      throw new Error('Webhook does not match expected signature')
    })

    const response = await POST(buildRequest({ id: 'evt_bad', description: 'tracker.updated' }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Webhook signature verification failed')
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is invalid (validator throws)', async () => {
    mockValidateWebhook.mockImplementation(() => {
      throw new Error('Unexpected token in JSON')
    })

    const response = await POST(buildRequest('{ not valid json'))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Webhook signature verification failed')
  })

  it('fails closed with 500 when no webhook secret is configured', async () => {
    delete process.env.EASYPOST_WEBHOOK_SECRET

    const response = await POST(buildRequest({ id: 'evt_x', description: 'tracker.updated' }))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Webhook secret not configured')
    // Verification is never even attempted without a secret
    expect(mockValidateWebhook).not.toHaveBeenCalled()
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
  })

  it('prevents duplicate event processing with an idempotency check', async () => {
    mockValidateWebhook.mockReturnValue({
      id: 'evt_duplicate',
      description: 'tracker.updated',
      result: { tracking_code: 'TRACK123456', status: 'in_transit' },
    })
    mockPrisma.webhookEvent.findFirst.mockResolvedValue({
      id: 'webhook-1',
      providerEventId: 'evt_duplicate',
      processed: true,
    })

    const response = await POST(buildRequest({}))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(mockHandleTrackerUpdated).not.toHaveBeenCalled()
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled()
  })

  it('handles tracker.created events by delegating to the handler', async () => {
    mockValidateWebhook.mockReturnValue({
      id: 'evt_created',
      description: 'tracker.created',
      result: { tracking_code: 'TRACK789', status: 'pre_transit' },
    })

    const response = await POST(buildRequest({}))

    expect(response.status).toBe(200)
    expect(mockHandleTrackerUpdated).toHaveBeenCalled()
  })

  it('returns 500 when the handler throws', async () => {
    mockValidateWebhook.mockReturnValue({
      id: 'evt_error',
      description: 'tracker.updated',
      result: { tracking_code: 'TRACK_ERROR', status: 'in_transit' },
    })
    mockHandleTrackerUpdated.mockRejectedValue(new Error('Database connection failed'))

    const response = await POST(buildRequest({}))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Webhook processing failed')
  })
})
