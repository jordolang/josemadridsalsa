import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const findUnique = vi.fn()
const update = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/rate-limit/distributed', () => ({ checkRateLimit }))
vi.mock('@/lib/prisma', () => {
  const client = { arenaGameCode: { findUnique, update } }
  return { prisma: client, default: client }
})

const { POST, OPTIONS } = await import('@/app/api/arena/game-codes/verify/route')

const verify = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/arena/game-codes/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify(body),
    }),
  )

describe('verifying a Battle Arena game code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, current: 1 })
    update.mockResolvedValue({})
  })

  it("names the group for a live code, however it was typed, and lets the game's origin read it", async () => {
    findUnique.mockResolvedValue({ id: 'c1', groupName: 'Lincoln PTA', revokedAt: null })
    const res = await verify({ code: 'jm 7kq4 x2pd' })
    expect(await res.json()).toEqual({ valid: true, name: 'Lincoln PTA' })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(findUnique.mock.calls[0][0].where).toEqual({ code: 'JM-7KQ4-X2PD' })
    expect(update).toHaveBeenCalled()
  })

  it('turns away revoked and unknown codes', async () => {
    findUnique.mockResolvedValueOnce({ id: 'c1', groupName: 'Lincoln PTA', revokedAt: new Date() })
    expect(await (await verify({ code: 'JM-7KQ4-X2PD' })).json()).toEqual({ valid: false })
    findUnique.mockResolvedValueOnce(null)
    expect(await (await verify({ code: 'JM-AAAA-BBBB' })).json()).toEqual({ valid: false })
  })

  it('does not look up text that is not a code', async () => {
    expect(await (await verify({ code: 'Lincoln PTA' })).json()).toEqual({ valid: false })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('still lets a good code in when the last-used stamp fails', async () => {
    findUnique.mockResolvedValue({ id: 'c1', groupName: 'Lincoln PTA', revokedAt: null })
    update.mockRejectedValue(new Error('db down'))
    expect(await (await verify({ code: 'JM-7KQ4-X2PD' })).json()).toEqual({ valid: true, name: 'Lincoln PTA' })
  })

  it('limits guessing per address', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 42, current: 31 })
    const res = await verify({ code: 'JM-7KQ4-X2PD' })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(checkRateLimit.mock.calls[0][0].identifier).toBe('arena-game-code:1.2.3.4')
  })

  it('answers the browser preflight', () => {
    const res = OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })
})
