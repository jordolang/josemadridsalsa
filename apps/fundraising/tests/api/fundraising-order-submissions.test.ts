import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/fundraising-site/order-submissions/route'
import { sendEmail } from '@/lib/email/sender'
import { logEngagementRequest } from '@/lib/engagements'
import { put } from '@vercel/blob'
import { createOrderPaymentCheckout } from '@/lib/fundraising-site/order-checkout'

vi.mock('server-only', () => ({}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/engagements', () => ({ logEngagementRequest: vi.fn().mockResolvedValue({ id: 'cmabc12345xyz' }) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/email/sender', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/bigcommerce/config', () => ({ isBigCommerceConfigured: vi.fn(() => true) }))
vi.mock('@/lib/fundraising-site/checkout-fields', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fundraising-site/checkout-fields')>()),
  getFundraisingCheckoutFields: vi.fn(async () => ({
    groupFieldId: 'field_26',
    sellerFieldId: 'field_28',
    groups: [{ value: '11', label: 'Lower Dauphin Band Boosters' }],
  })),
}))
vi.mock('@/lib/fundraising-site/order-checkout', () => ({ createOrderPaymentCheckout: vi.fn() }))

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
  signature:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGNgYGD4D8UQBgAd9AP9yOH2qAAAAABJRU5ErkJggg==',
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
    vi.mocked(put).mockReset().mockResolvedValue({ url: 'https://blob.example/signed.pdf' } as Awaited<ReturnType<typeof put>>)
    vi.mocked(logEngagementRequest).mockClear()
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
  })

  it('archives a signed PDF, links it in both emails and keeps the image out of the record', async () => {
    const response = await post(valid)
    expect(response.status).toBe(200)
    expect((await response.json()).pdfUrl).toBe('https://blob.example/signed.pdf')
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^fundraising\/order-submissions\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-lincoln-b-pto-b\.pdf$/),
      expect.anything(),
      expect.objectContaining({ contentType: 'application/pdf', addRandomSuffix: true }),
    )
    for (const [mail] of vi.mocked(sendEmail).mock.calls) expect(mail.text).toContain('https://blob.example/signed.pdf')
    expect(JSON.stringify(vi.mocked(logEngagementRequest).mock.calls[0][0])).not.toContain('base64')
  })

  it('still delivers the order when the PDF cannot be stored', async () => {
    vi.mocked(put).mockRejectedValueOnce(new Error('blob down'))
    const response = await post(valid)
    expect(response.status).toBe(200)
    expect((await response.json()).pdfUrl).toBeNull()
    expect(sendEmail).toHaveBeenCalledTimes(2)
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
    ['an unsigned order', { signature: undefined }],
    ['a signature that is not a PNG', { signature: 'data:image/jpeg;base64,AAAA' }],
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

  describe('paying by card online', () => {
    const card = { ...valid, paymentMethod: 'card-online', group: 'lower dauphin band boosters' }

    beforeEach(() => {
      vi.mocked(createOrderPaymentCheckout)
        .mockReset()
        .mockResolvedValue({ checkoutUrl: 'https://store.example/checkout/abc', amountDue: 70 })
    })

    it('builds the store checkout and sends its link to the coordinator', async () => {
      const response = await post(card)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({ checkoutUrl: 'https://store.example/checkout/abc', cardTotal: 70, amountDue: 60 })
      expect(createOrderPaymentCheckout).toHaveBeenCalledWith(expect.objectContaining({ quantities: valid.quantities }), '12345XYZ')
      const [inbox, confirmation] = vi.mocked(sendEmail).mock.calls.map(([options]) => options)
      expect(inbox.text).toContain('fill it once')
      expect(confirmation.html).toContain('href="https://store.example/checkout/abc"')
      expect(confirmation.text).toContain('Pay $70 (including shipping) by card')
    })

    it('requires a group', async () => {
      const response = await post({ ...card, group: undefined })
      expect(response.status).toBe(400)
      expect(createOrderPaymentCheckout).not.toHaveBeenCalled()
    })

    it('refuses a group the store cannot credit, before recording the order', async () => {
      const response = await post({ ...card, group: 'Not A Real Group' })
      expect(response.status).toBe(422)
      expect(logEngagementRequest).not.toHaveBeenCalled()
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('still takes the order when the store checkout cannot be built', async () => {
      vi.mocked(createOrderPaymentCheckout).mockRejectedValueOnce(new Error('BigCommerce down'))
      const response = await post(card)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.checkoutUrl).toBeNull()
      expect(vi.mocked(sendEmail).mock.calls[0][0].text).toContain('contact the coordinator to take payment')
    })
  })
})
