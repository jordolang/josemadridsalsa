import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  arenaPlayer: { findUnique: vi.fn(), update: vi.fn() },
  arenaFriend: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  arenaRoomInvite: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}))
const auth = vi.hoisted(() => ({ requirePlayer: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))
vi.mock('@/lib/arena-game/players', () => ({ requirePlayer: auth.requirePlayer }))

const friends = await import('@/lib/arena-game/friends')
const friendsRoute = await import('@/app/api/arena/friends/route')
const presenceRoute = await import('@/app/api/arena/friends/presence/route')
const inviteRoute = await import('@/app/api/arena/friends/invites/route')
const { ArenaGameError } = await import('@/lib/arena-game/http')

const SITE = 'https://www.josemadrid.net'
const GAME = 'https://battle-arena-3d-mauve.vercel.app'
const me = { id: 'p_me', handle: 'Maria 1234', userId: 'u_1' }
const ana = { id: 'p_ana', handle: 'Ana 77', userId: 'u_2' }
const now = new Date('2026-10-07T12:00:00Z')

function row(p: { id: string; handle: string }, seenAgo: number | null, room: string | null = null) {
  return { id: p.id, handle: p.handle, seenAt: seenAgo == null ? null : new Date(now.getTime() - seenAgo * 1000), room, team: null }
}

function post(path: string, body: unknown) {
  return new Request(`${SITE}${path}`, {
    method: 'POST',
    headers: { origin: GAME, authorization: 'Bearer x', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  db.arenaFriend.findMany.mockResolvedValue([])
  db.arenaRoomInvite.findMany.mockResolvedValue([])
  db.arenaPlayer.findUnique.mockImplementation(async ({ where }: { where: { handleKey: string } }) =>
    [me, ana].find((p) => p.handle.toLowerCase() === where.handleKey) ?? null
  )
})

describe('friendsView', () => {
  it('lists friends online first and shows rooms only for online friends', async () => {
    const bob = { id: 'p_bob', handle: 'Bob' }
    db.arenaFriend.findMany.mockResolvedValue([
      { requesterId: me.id, addresseeId: bob.id, status: 'ACCEPTED', createdAt: now, requester: row(me, 0), addressee: row(bob, 600, 'ABCDE') },
      { requesterId: ana.id, addresseeId: me.id, status: 'ACCEPTED', createdAt: now, requester: row(ana, 20, 'XYZ23'), addressee: row(me, 0) },
      { requesterId: 'p_cy', addresseeId: me.id, status: 'PENDING', createdAt: now, requester: row({ id: 'p_cy', handle: 'Cy' }, null), addressee: row(me, 0) },
    ])
    const view = await friends.friendsView(me, now)
    expect(view.friends.map((f) => [f.handle, f.online, f.room])).toEqual([
      ['Ana 77', true, 'XYZ23'],
      ['Bob', false, null],
    ])
    expect(view.incoming.map((r) => r.handle)).toEqual(['Cy'])
    expect(view.outgoing).toEqual([])
  })

  it('drops room invites from people who are no longer friends', async () => {
    db.arenaRoomInvite.findMany.mockResolvedValue([
      { from: { handle: 'Stranger' }, room: 'ABCDE', createdAt: now, expiresAt: now },
    ])
    expect((await friends.friendsView(me, now)).invites).toEqual([])
  })
})

describe('addFriend', () => {
  it('accepts when the other player already asked', async () => {
    db.arenaFriend.findFirst.mockResolvedValue({ id: 'f1', requesterId: ana.id, addresseeId: me.id, status: 'PENDING' })
    await friends.addFriend(me as never, 'ana 77')
    expect(db.arenaFriend.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'f1' }, data: expect.objectContaining({ status: 'ACCEPTED' }) }))
    expect(db.arenaFriend.create).not.toHaveBeenCalled()
  })

  it('sends a new request otherwise', async () => {
    db.arenaFriend.findFirst.mockResolvedValue(null)
    db.arenaFriend.count.mockResolvedValue(0)
    await friends.addFriend(me as never, 'Ana 77')
    expect(db.arenaFriend.create).toHaveBeenCalledWith({ data: { requesterId: me.id, addresseeId: ana.id } })
  })

  it('refuses yourself and unknown names', async () => {
    await expect(friends.addFriend(me as never, 'Maria 1234')).rejects.toBeInstanceOf(ArenaGameError)
    await expect(friends.addFriend(me as never, 'Nobody Here')).rejects.toMatchObject({ status: 404 })
  })
})

describe('inviteFriend', () => {
  it('only invites accepted friends', async () => {
    db.arenaFriend.findFirst.mockResolvedValue({ status: 'PENDING' })
    await expect(friends.inviteFriend(me as never, 'Ana 77', 'ABCDE')).rejects.toMatchObject({ status: 403 })
    expect(db.arenaRoomInvite.create).not.toHaveBeenCalled()
  })

  it('limits invites per minute', async () => {
    db.arenaFriend.findFirst.mockResolvedValue({ status: 'ACCEPTED' })
    db.arenaRoomInvite.count.mockResolvedValue(friends.INVITES_PER_MINUTE)
    await expect(friends.inviteFriend(me as never, 'Ana 77', 'ABCDE')).rejects.toMatchObject({ status: 429 })
  })
})

describe('routes', () => {
  it('rejects a room code the game could not have made', async () => {
    auth.requirePlayer.mockResolvedValue(me)
    const res = await inviteRoute.POST(post('/api/arena/friends/invites', { handle: 'Ana 77', room: 'abc<1' }))
    expect(res.status).toBe(400)
  })

  it('checks in with a room and answers the game cross-origin', async () => {
    auth.requirePlayer.mockResolvedValue(me)
    const res = await presenceRoute.POST(post('/api/arena/friends/presence', { room: 'ABCDE' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(GAME)
    expect(db.arenaPlayer.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: me.id }, data: expect.objectContaining({ room: 'ABCDE' }) }))
    expect(await res.json()).toMatchObject({ friends: [], invites: [] })
  })

  it('needs a signed-in player', async () => {
    auth.requirePlayer.mockRejectedValue(new ArenaGameError('Sign in', 401, 'signed_out'))
    const res = await friendsRoute.GET(new Request(`${SITE}/api/arena/friends`, { headers: { origin: GAME } }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'signed_out' })
  })
})
