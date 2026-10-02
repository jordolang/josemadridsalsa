import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { findUnique, submissionCreate, sendEmail } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  submissionCreate: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { fundraiser: { findUnique }, contactSubmission: { create: submissionCreate } },
}))
vi.mock('@/lib/email/client', () => ({ sendEmail }))
vi.mock('@/lib/email/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }) }))
vi.mock('@/emails/contact-form', () => ({ ContactFormEmail: () => null }))

const { POST } = await import('@/app/api/fundraiser-portal/contact/route')

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost:3000/api/fundraiser-portal/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  submissionCreate.mockResolvedValue({ id: 'cs1' })
  findUnique.mockResolvedValue({
    name: 'Band Boosters',
    contactEmail: 'coach@example.com',
    pageConfig: {
      version: 1,
      theme: 'default',
      blocks: [{ type: 'contact_form', fields: ['name', 'email', 'message'], recipientEmail: 'booster@example.com' }],
    },
  })
})

describe('POST /api/fundraiser-portal/contact', () => {
  it('stores the message and emails the recipient from the saved page config', async () => {
    const res = await post({ fundraiserSlug: 'band', name: 'Ana', email: 'ana@example.com', message: 'Hi' })

    expect(res.status).toBe(201)
    expect(submissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Ana', email: 'ana@example.com', message: 'Hi' }),
    })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'booster@example.com', replyTo: 'ana@example.com' })
    )
  })

  it('ignores a recipient supplied by the browser', async () => {
    findUnique.mockResolvedValue({ name: 'Band Boosters', contactEmail: 'coach@example.com', pageConfig: null })

    await post({ fundraiserSlug: 'band', message: 'Hi', recipientEmail: 'victim@example.com' })

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'coach@example.com' }))
  })

  it('rejects an empty submission', async () => {
    const res = await post({ fundraiserSlug: 'band' })

    expect(res.status).toBe(400)
    expect(submissionCreate).not.toHaveBeenCalled()
  })

  it('404s an unknown fundraiser', async () => {
    findUnique.mockResolvedValue(null)

    const res = await post({ fundraiserSlug: 'nope', message: 'Hi' })

    expect(res.status).toBe(404)
  })
})
