import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { put, sendEmail, logEngagementRequest, logAudit, checkRateLimit } = vi.hoisted(() => ({
  put: vi.fn(),
  sendEmail: vi.fn(),
  logEngagementRequest: vi.fn(),
  logAudit: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@vercel/blob', () => ({ put }))
vi.mock('@/lib/email/sender', () => ({ sendEmail }))
vi.mock('@/lib/engagements', () => ({ logEngagementRequest }))
vi.mock('@/lib/audit', () => ({ logAudit }))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit,
  createRateLimitHeaders: () => ({ 'X-RateLimit-Remaining': '0' }),
  getClientIdentifier: () => '203.0.113.9',
}))

import { POST } from '@/app/api/fundraiser-order-forms/route'

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGNgYGD4D8UQBgAd9AP9yOH2qAAAAABJRU5ErkJggg=='

const validBody = {
  organizationName: 'Lincoln Elementary PTO',
  contactName: 'Pat Smith',
  email: 'pat@example.com',
  phone: '740-555-0123',
  shipTo: { name: 'Pat Smith', street: '1 Main St', city: 'Zanesville', state: 'OH', postalCode: '43701' },
  quantities: { 'raspberry-mild': 100 },
  agreed: true,
  signature: SIGNATURE,
}

function post(body: unknown) {
  return POST(
    new NextRequest('https://fundraising.josemadridsalsa.com/api/fundraiser-order-forms', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('POST /api/fundraiser-order-forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
    vi.stubEnv('FUNDRAISING_EMAIL', 'fundraising@example.com')
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetIn: 3600, current: 1 })
    put.mockResolvedValue({ url: 'https://blob.example/order.pdf' })
    sendEmail.mockResolvedValue({ success: true })
  })

  it('archives the signed PDF, logs the order and emails both parties', async () => {
    const response = await post(validBody)
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.code).toMatch(/^FO-[0-9A-F]{6}$/)
    expect(data.totals).toMatchObject({ totalJars: 100, dueCents: 50_000, freeShipping: true })
    expect(data.pdfUrl).toBe('https://blob.example/order.pdf')

    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^fundraising\/order-forms\/\d{4}\/\d{2}\/.*lincoln-elementary-pto-fo-[0-9a-f]{6}\.pdf$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/pdf', addRandomSuffix: true }),
    )
    expect(logEngagementRequest).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FUNDRAISER', source: 'site:fundraising:order-form' }),
    )
    const recipients = sendEmail.mock.calls.map(([options]) => options.to)
    expect(recipients).toEqual(['fundraising@example.com', 'pat@example.com'])
    // The signature image never lands in the audit log.
    expect(JSON.stringify(logAudit.mock.calls[0][0].changes)).not.toContain('base64')
  })

  it('still accepts the order when blob storage is not configured', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    const response = await post(validBody)
    expect(response.status).toBe(201)
    expect(put).not.toHaveBeenCalled()
    expect((await response.json()).pdfUrl).toBeNull()
  })

  it('rejects an unsigned or unconfirmed order', async () => {
    const unsigned = await post({ ...validBody, signature: undefined })
    expect(unsigned.status).toBe(422)
    const unconfirmed = await post({ ...validBody, agreed: false })
    expect(unconfirmed.status).toBe(422)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rate limits a runaway client', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 60, current: 11 })
    const response = await post(validBody)
    expect(response.status).toBe(429)
    expect(put).not.toHaveBeenCalled()
  })
})
