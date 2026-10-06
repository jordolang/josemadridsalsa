import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashSessionToken } from '@/lib/arena-game/rules'

const db = vi.hoisted(() => ({
  arenaPlayer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  arenaPlayerSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  arenaMatch: { findMany: vi.fn(), groupBy: vi.fn() },
  fundraiserCharacter: { findFirst: vi.fn() },
  fundraiserAccount: { findUnique: vi.fn() },
  fundraiserTeam: { findUnique: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))

const { createGameSession, ensurePlayer, requirePlayer, revokeGameSession, updateSelf, describeSelf } = await import('@/lib/arena-game/players')
const { ArenaGameError } = await import('@/lib/arena-game/http')

const player = (over: Record<string, unknown> = {}) => ({
  id: 'p_1',
  userId: 'u_1',
  handle: 'Maria 1234',
  handleKey: 'maria 1234',
  teamId: null as string | null,
  teamChangedAt: null as Date | null,
  matches: 4,
  wins: 3,
  roundsWon: 7,
  knockouts: 9,
  damage: 1200,
  currentStreak: 2,
  bestStreak: 3,
  lastPlayedAt: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
  ...over,
})

const withToken = (token: string) => new Request('https://www.josemadrid.net/api/arena/me', { headers: { authorization: `Bearer ${token}` } })
const TOKEN = 'a'.repeat(43)

beforeEach(() => {
  vi.clearAllMocks()
  db.fundraiserCharacter.findFirst.mockResolvedValue(null)
  db.fundraiserAccount.findUnique.mockResolvedValue(null)
  db.arenaMatch.findMany.mockResolvedValue([])
  db.arenaMatch.groupBy.mockResolvedValue([])
  db.arenaPlayer.count.mockResolvedValue(0)
  db.fundraiserTeam.findUnique.mockResolvedValue(null)
})

describe('ensurePlayer', () => {
  it('returns the existing player', async () => {
    db.arenaPlayer.findUnique.mockResolvedValue(player())
    expect((await ensurePlayer({ id: 'u_1', name: 'Maria' })).id).toBe('p_1')
    expect(db.arenaPlayer.create).not.toHaveBeenCalled()
  })

  it('retries a handle that is taken', async () => {
    db.arenaPlayer.findUnique.mockResolvedValue(null)
    db.arenaPlayer.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' })).mockResolvedValue(player())
    await ensurePlayer({ id: 'u_1', name: 'Maria Lopez' })
    expect(db.arenaPlayer.create).toHaveBeenCalledTimes(2)
    expect(db.arenaPlayer.create.mock.calls[0][0].data.handle).toMatch(/^Maria \d{4}$/)
  })
})

describe('game sessions', () => {
  it('stores only the hash of a new token', async () => {
    const token = await createGameSession('p_1', 'Mozilla')
    const data = db.arenaPlayerSession.create.mock.calls[0][0].data
    expect(data.tokenHash).toBe(hashSessionToken(token))
    expect(JSON.stringify(data)).not.toContain(token)
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000)
  })

  it('signs the player in from a live token', async () => {
    db.arenaPlayerSession.findUnique.mockResolvedValue({
      id: 's_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      lastUsedAt: new Date(),
      player: player(),
    })
    expect((await requirePlayer(withToken(TOKEN))).id).toBe('p_1')
    expect(db.arenaPlayerSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashSessionToken(TOKEN) } }))
    expect(db.arenaPlayerSession.update).not.toHaveBeenCalled()
  })

  it('refuses missing, revoked and expired tokens as signed out', async () => {
    await expect(requirePlayer(new Request('https://x.test'))).rejects.toMatchObject({ status: 401, code: 'signed_out' })
    db.arenaPlayerSession.findUnique.mockResolvedValue({ id: 's', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1e6), lastUsedAt: new Date(), player: player() })
    await expect(requirePlayer(withToken(TOKEN))).rejects.toMatchObject({ code: 'signed_out' })
    db.arenaPlayerSession.findUnique.mockResolvedValue({ id: 's', revokedAt: null, expiresAt: new Date(Date.now() - 1), lastUsedAt: new Date(), player: player() })
    await expect(requirePlayer(withToken(TOKEN))).rejects.toBeInstanceOf(ArenaGameError)
  })

  it('touches a session that has not been used for a while', async () => {
    db.arenaPlayerSession.findUnique.mockResolvedValue({
      id: 's_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      lastUsedAt: new Date(Date.now() - 2 * 3_600_000),
      player: player(),
    })
    await requirePlayer(withToken(TOKEN))
    expect(db.arenaPlayerSession.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's_1' } }))
  })

  it('revokes by token hash', async () => {
    await revokeGameSession(withToken(TOKEN))
    expect(db.arenaPlayerSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashSessionToken(TOKEN), revokedAt: null } }))
  })
})

describe('groups', () => {
  it('puts a player in the group of the character they claimed, and locks it', async () => {
    db.fundraiserCharacter.findFirst.mockResolvedValue({ teamId: 't_band' })
    db.arenaPlayer.update.mockResolvedValue(player({ teamId: 't_band' }))
    db.fundraiserTeam.findUnique.mockResolvedValue({ id: 't_band', slug: 'band', name: 'Band', school: 'ZHS', teamColor: '#f00', status: 'ACTIVE' })
    const view = await describeSelf(player())
    expect(db.arenaPlayer.update).toHaveBeenCalledWith({ where: { id: 'p_1' }, data: { teamId: 't_band' } })
    expect(view.player.team?.name).toBe('Band')
    expect(view.player.teamLocked).toBe(true)
    expect(view.player.stats.losses).toBe(1)
    expect(view.player.stats.winRate).toBe(75)
  })

  it('uses the team of the fundraiser the account runs', async () => {
    db.fundraiserAccount.findUnique.mockResolvedValue({ fundraiser: { arenaTeam: { id: 't_org' } } })
    db.arenaPlayer.update.mockResolvedValue(player({ teamId: 't_org' }))
    await describeSelf(player())
    expect(db.arenaPlayer.update).toHaveBeenCalledWith({ where: { id: 'p_1' }, data: { teamId: 't_org' } })
  })

  it('will not change a group that comes from the account', async () => {
    db.fundraiserCharacter.findFirst.mockResolvedValue({ teamId: 't_band' })
    await expect(updateSelf(player({ teamId: 't_band' }), { teamId: 't_other' })).rejects.toMatchObject({ status: 409 })
  })

  it('limits how often a player picks a group', async () => {
    await expect(updateSelf(player({ teamId: 't_a', teamChangedAt: new Date() }), { teamId: 't_b' })).rejects.toMatchObject({ status: 409 })
  })

  it('only joins active groups', async () => {
    db.fundraiserTeam.findUnique.mockResolvedValue({ status: 'ENDED' })
    await expect(updateSelf(player(), { teamId: 't_old' })).rejects.toMatchObject({ status: 400 })
  })

  it('joins an active group and records when', async () => {
    db.fundraiserTeam.findUnique.mockResolvedValueOnce({ status: 'ACTIVE' })
    db.arenaPlayer.update.mockResolvedValue(player({ teamId: 't_b' }))
    await updateSelf(player(), { teamId: 't_b' })
    const data = db.arenaPlayer.update.mock.calls[0][0].data
    expect(data.team).toEqual({ connect: { id: 't_b' } })
    expect(data.teamChangedAt).toBeInstanceOf(Date)
  })
})

describe('renaming', () => {
  it('stores the cleaned name and its key', async () => {
    db.arenaPlayer.update.mockResolvedValue(player({ handle: 'Salsa King' }))
    await updateSelf(player(), { handle: '  Salsa   King ' })
    expect(db.arenaPlayer.update.mock.calls[0][0].data).toEqual({ handle: 'Salsa King', handleKey: 'salsa king' })
  })

  it('reports a taken name', async () => {
    db.arenaPlayer.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(updateSelf(player(), { handle: 'Salsa King' })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/already has that name/) })
  })

  it('rejects names that break the rules', async () => {
    await expect(updateSelf(player(), { handle: 'x' })).rejects.toMatchObject({ status: 400 })
  })
})
