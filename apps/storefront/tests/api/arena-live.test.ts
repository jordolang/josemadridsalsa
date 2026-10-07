import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ arenaPlayer: { count: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))

const { countPlayersOnline, ONLINE_SECONDS } = await import('@/lib/arena-game/friends')
const liveRoute = await import('@/app/api/arena/live/route')

const now = new Date('2026-10-07T12:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('countPlayersOnline', () => {
  it('counts players whose game checked in within the online window', async () => {
    db.arenaPlayer.count.mockResolvedValue(3)
    await expect(countPlayersOnline(now)).resolves.toBe(3)
    expect(db.arenaPlayer.count).toHaveBeenCalledWith({
      where: { seenAt: { gt: new Date(now.getTime() - ONLINE_SECONDS * 1000) } },
    })
  })
})

describe('GET /api/arena/live', () => {
  it('returns the live player count, cacheable and open to any origin', async () => {
    db.arenaPlayer.count.mockResolvedValue(2)
    const res = await liveRoute.GET(new Request('https://www.josemadrid.net/api/arena/live'))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ playing: 2 })
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=20/)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('fails without leaking details when the database is down', async () => {
    db.arenaPlayer.count.mockRejectedValue(new Error('connection refused'))
    const res = await liveRoute.GET(new Request('https://www.josemadrid.net/api/arena/live'))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/connection refused/)
  })
})
