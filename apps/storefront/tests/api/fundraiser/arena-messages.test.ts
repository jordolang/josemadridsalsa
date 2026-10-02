import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getServerSession = vi.fn()
const messageCreate = vi.fn()
const messageFindMany = vi.fn()
const teamFindUnique = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: () => ({ allowed: true, retryAfterMs: 0 }) }))
vi.mock('@/lib/prisma', () => {
  const client = {
    arenaMessage: { create: messageCreate, findMany: messageFindMany },
    fundraiserTeam: { findUnique: teamFindUnique },
  }
  return { prisma: client, default: client }
})

const { GET, POST } = await import('@/app/api/fundraiser/arena/[period]/messages/route')

const params = (period = '2026-10') => ({ params: Promise.resolve({ period }) })
const post = (body: unknown) =>
  new NextRequest('http://localhost/api/fundraiser/arena/2026-10/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('arena messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageCreate.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'm1', teamId: data.teamId, body: data.body, createdAt: new Date(0), author: { name: 'Jane Q Public' } }),
    )
  })

  it('requires sign-in to post', async () => {
    getServerSession.mockResolvedValue(null)
    const res = await POST(post({ body: 'hi' }), params())
    expect(res.status).toBe(401)
    expect(messageCreate).not.toHaveBeenCalled()
  })

  it('stores the message server-side and shows only the first name', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u1' } })
    teamFindUnique.mockResolvedValue({ id: 'team-1' })
    const res = await POST(post({ body: '  go   team  ', teamId: 'team-1' }), params())
    expect(res.status).toBe(201)
    expect(messageCreate.mock.calls[0][0].data).toEqual({ period: '2026-10', teamId: 'team-1', authorUserId: 'u1', body: 'go team' })
    expect((await res.json()).message.author).toBe('Jane')
  })

  it('drops an unknown team rather than trusting it', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u1' } })
    teamFindUnique.mockResolvedValue(null)
    await POST(post({ body: 'hi', teamId: 'nope' }), params())
    expect(messageCreate.mock.calls[0][0].data.teamId).toBeNull()
  })

  it('rejects over-long messages and bad periods', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u1' } })
    expect((await POST(post({ body: 'x'.repeat(121) }), params())).status).toBe(422)
    expect((await POST(post({ body: 'hi' }), params('bad'))).status).toBe(400)
  })

  it('serves the latest messages to everyone', async () => {
    messageFindMany.mockResolvedValue([
      { id: 'm1', teamId: null, body: 'hi', createdAt: new Date(0), author: { name: null } },
    ])
    const res = await GET(new NextRequest('http://localhost/api/fundraiser/arena/2026-10/messages'), params())
    expect((await res.json()).messages).toEqual([{ id: 'm1', teamId: null, author: 'Fan', body: 'hi', createdAt: 0 }])
  })
})
