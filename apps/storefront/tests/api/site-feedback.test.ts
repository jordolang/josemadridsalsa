import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { siteFeedback: { create } }
  return { prisma: client, default: client }
})
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit,
  createRateLimitHeaders: () => ({}),
  getClientIdentifier: () => '203.0.113.7',
  RATE_LIMITS: { API_GENERAL: { maxRequests: 100, windowSeconds: 60 } },
}))

const { POST } = await import('@/app/api/site-feedback/route')

function post(body: unknown) {
  return new Request('http://localhost:3000/api/site-feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 60 })
  create.mockResolvedValue({ id: 'fb_1' })
})

describe('POST /api/site-feedback', () => {
  it('stores the ratings with their average', async () => {
    const res = await POST(
      post({
        ratings: { layout: 9, battleArena: 6 },
        comment: ' Great site ',
        email: '',
        source: 'feedback-page',
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'fb_1', success: true })
    expect(create).toHaveBeenCalledWith({
      data: {
        ratings: { layout: 9, battleArena: 6 },
        averageRating: 7.5,
        comment: 'Great site',
        name: null,
        email: null,
        source: 'feedback-page',
        ipAddress: '203.0.113.7',
        userAgent: 'vitest',
      },
      select: { id: true },
    })
  })

  it('rejects an out-of-range score', async () => {
    const res = await POST(post({ ratings: { layout: 11 } }))
    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects an empty submission', async () => {
    const res = await POST(post({ ratings: {} }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Rate at least one part of the site or leave a comment.')
  })

  it('rate limits', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, resetIn: 30 })
    const res = await POST(post({ ratings: { layout: 5 } }))
    expect(res.status).toBe(429)
    expect(create).not.toHaveBeenCalled()
  })
})
