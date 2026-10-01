import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/fundraising-site/order-submissions/route'
import { sendEmail } from '@/lib/email/sender'

vi.mock('@/lib/engagements', () => ({ logEngagementRequest: vi.fn().mockResolvedValue({ id: 'cmabc12345xyz' }) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/email/sender', () => ({ sendEmail: vi.fn() }))

const valid = {
  kit: '9',
  organizationName: 'Lincoln <b>PTO</b>',
  contactName: 'Pat Smith',
  email: 'Pat@Example.com',
  phone: '740-555-1212',
  shipName: 'Lincoln Elementary',
  shipStreet: '1 Main St',
  shipCity: 'Zanesville',
  shipState: 'OH',
  shipZip: '43701',
  quantities: { raspberry: 10, 'original-hot': 2 },
  paymentMethod: 'check',
  confirmFinal: true,
}

let ipCounter = 0
const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/fundraising-site/order-submissions', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'x-forwarded-for': `10.0.0.${++ipCounter}` },
    }),
  )

describe('POST /api/fundraising-site/order-submissions', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset().mockResolvedValue({ success: true })
  })

  it('emails the order to the fundraising inbox and returns the totals', async () => {
    const response = await post(valid)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({ success: true, totalJars: 12, amountDue: 60, salesValue: 120, reference: 'C12345XYZ'.slice(-8) })
    const inbox = vi.mocked(sendEmail).mock.calls[0][0]
    expect(inbox.subject).toBe('FINAL fundraiser order: Lincoln <b>PTO</b> — 12 jars')
    expect(inbox.replyTo).toBe('pat@example.com')
    expect(inbox.html).toContain('Lincoln &lt;b&gt;PTO&lt;/b&gt;')
    expect(inbox.html).not.toContain('<b>PTO</b>')
    expect(inbox.text).toContain('Raspberry – Mild')
    expect(vi.mocked(sendEmail).mock.calls[1][0].to).toBe('pat@example.com')
  })

  it('reports failure when the inbox email does not send', async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce({ success: false, error: 'smtp down' })
    const response = await post(valid)
    expect(response.status).toBe(502)
  })

  it.each([
    ['an unconfirmed order', { confirmFinal: false }],
    ['a flavor outside the chosen kit', { quantities: { strawberry: 3 } }],
    ['an order with no jars', { quantities: { raspberry: 0 } }],
    ['a bad ZIP code', { shipZip: '4370' }],
    ['a fractional quantity', { quantities: { raspberry: 1.5 } }],
  ])('rejects %s', async (_, override) => {
    const response = await post({ ...valid, ...override })
    expect(response.status).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rate limits repeated submissions from one address', async () => {
    const request = () =>
      POST(
        new NextRequest('http://localhost/api/fundraising-site/order-submissions', {
          method: 'POST',
          body: JSON.stringify(valid),
          headers: { 'x-forwarded-for': '10.9.9.9' },
        }),
      )
    for (let i = 0; i < 5; i++) expect((await request()).status).toBe(200)
    expect((await request()).status).toBe(429)
  })
})
