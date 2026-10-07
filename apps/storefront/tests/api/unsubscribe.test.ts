import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * RFC 8058 one-click unsubscribe. Gmail and Yahoo POST `List-Unsubscribe=One-Click` as a form
 * body straight to the `List-Unsubscribe` URL automation emails carry; the signed token in that
 * URL is the only proof the request is for that address.
 */

const preferenceUpsert = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { unsubscribePreference: { upsert: preferenceUpsert } }
  return { prisma: client, default: client }
})

const { POST } = await import('@/app/api/unsubscribe/route')
const { buildOneClickUnsubscribeUrl } = await import('@/lib/email/unsubscribe-url')

function oneClick(url: string, body = 'List-Unsubscribe=One-Click') {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
}

beforeEach(() => {
  preferenceUpsert.mockReset()
  preferenceUpsert.mockResolvedValue({})
})

describe('POST /api/unsubscribe (one-click)', () => {
  it('unsubscribes the address in a correctly signed List-Unsubscribe URL from everything', async () => {
    const response = await POST(oneClick(buildOneClickUnsubscribeUrl('Buyer@Example.com')))

    expect(response.status).toBe(200)
    expect(preferenceUpsert).toHaveBeenCalledWith({
      where: { email: 'buyer@example.com' },
      create: { email: 'buyer@example.com', unsubscribeAll: true, unsubscribedFrom: [] },
      update: expect.objectContaining({ unsubscribeAll: true }),
    })
  })

  it('does not rate-limit by the shared provider IP that one-click requests arrive from', async () => {
    // Gmail and Yahoo send every recipient's request from their own infrastructure.
    for (let i = 0; i < 12; i++) {
      const response = await POST(oneClick(buildOneClickUnsubscribeUrl(`reader${i}@example.com`)))
      expect(response.status).toBe(200)
    }
  })

  it('caps forged one-click requests per IP before verifying them', async () => {
    const forged = (i: number) => {
      const req = oneClick(`https://www.josemadridsalsa.com/api/unsubscribe?email=x${i}@example.com&token=bad`)
      return new Request(req, { headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '203.0.113.9' } })
    }
    const statuses = []
    for (let i = 0; i < 21; i++) statuses.push((await POST(forged(i))).status)

    expect(statuses.slice(0, 20).every((s) => s === 400)).toBe(true)
    expect(statuses[20]).toBe(429)
  })

  it('refuses a URL whose token does not match the address', async () => {
    const forged = buildOneClickUnsubscribeUrl('buyer@example.com').replace(
      'buyer%40example.com',
      'someone-else%40example.com'
    )

    const response = await POST(oneClick(forged))

    expect(response.status).toBe(400)
    expect(preferenceUpsert).not.toHaveBeenCalled()
  })

  it('refuses a form post that is not a one-click request', async () => {
    const response = await POST(
      oneClick(buildOneClickUnsubscribeUrl('buyer@example.com'), 'List-Unsubscribe=Maybe')
    )

    expect(response.status).toBe(400)
    expect(preferenceUpsert).not.toHaveBeenCalled()
  })
})
