/**
 * Battle Arena game players: signing the game in as a José Madrid account, the player's
 * profile, and the fundraising group they fight for.
 *
 *   Connect   signed in on this site → /battle-arena/connect → a token for the game
 *   Play      the game sends the token as `Authorization: Bearer …` on every call
 *   Sign out  the game revokes its token; the account stays signed in here
 */
import type { ArenaPlayer, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { ArenaGameError } from './http'
import {
  HandleSchema,
  TEAM_CHANGE_DAYS,
  bearerToken,
  handleKey,
  hashSessionToken,
  needsTouch,
  newSessionToken,
  sessionExpiry,
  suggestHandle,
} from './rules'

const teamSelect = { id: true, slug: true, name: true, school: true, teamColor: true, status: true } as const
type TeamSummary = Prisma.FundraiserTeamGetPayload<{ select: typeof teamSelect }>

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

/** The account's player, made on first sign-in with a handle built from their name. */
export async function ensurePlayer(user: { id: string; name?: string | null }): Promise<ArenaPlayer> {
  const existing = await prisma.arenaPlayer.findUnique({ where: { userId: user.id } })
  if (existing) return existing
  // A handle collision just means another number; a userId collision means a second tab won.
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle = suggestHandle(user.name)
    try {
      return await prisma.arenaPlayer.create({ data: { userId: user.id, handle, handleKey: handleKey(handle) } })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = await prisma.arenaPlayer.findUnique({ where: { userId: user.id } })
      if (raced) return raced
    }
  }
  throw new ArenaGameError('Could not set up your fighter. Please try again.', 500)
}

/** A new game sign-in for the player. Returns the raw token, which is never stored. */
export async function createGameSession(playerId: string, userAgent?: string | null): Promise<string> {
  const token = newSessionToken()
  await prisma.arenaPlayerSession.create({
    data: {
      playerId,
      tokenHash: hashSessionToken(token),
      userAgent: userAgent?.slice(0, 200) || null,
      expiresAt: sessionExpiry(),
    },
  })
  return token
}

/** The player behind a request's bearer token; throws `signed_out` when there is none. */
export async function requirePlayer(request: Request): Promise<ArenaPlayer> {
  const token = bearerToken(request)
  if (!token) throw new ArenaGameError('Sign in with your José Madrid account to play.', 401, 'signed_out')
  const session = await prisma.arenaPlayerSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { player: true },
  })
  const now = new Date()
  if (!session || session.revokedAt || session.expiresAt <= now) {
    throw new ArenaGameError('Your sign-in has ended. Sign in again to keep playing.', 401, 'signed_out')
  }
  if (needsTouch(session.lastUsedAt, now)) {
    await prisma.arenaPlayerSession.update({ where: { id: session.id }, data: { lastUsedAt: now } })
  }
  return session.player
}

/** Sign the game out. Signing out twice, or with a token that has ended, is not an error. */
export async function revokeGameSession(request: Request): Promise<void> {
  const token = bearerToken(request)
  if (!token) return
  await prisma.arenaPlayerSession.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * The group the account belongs to on the fundraising side, if any: the team of the character
 * they claimed, else the team of the fundraiser they run. Such a player cannot pick another group.
 */
export async function accountTeamId(userId: string): Promise<string | null> {
  const character = await prisma.fundraiserCharacter.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { teamId: true },
  })
  if (character) return character.teamId
  const account = await prisma.fundraiserAccount.findUnique({
    where: { userId },
    select: { fundraiser: { select: { arenaTeam: { select: { id: true } } } } },
  })
  return account?.fundraiser.arenaTeam?.id ?? null
}

/** Bring the player's group in line with their account, and say whether they may change it. */
async function syncTeam(player: ArenaPlayer): Promise<{ player: ArenaPlayer; locked: boolean }> {
  const fixed = await accountTeamId(player.userId)
  if (!fixed) return { player, locked: false }
  if (fixed === player.teamId) return { player, locked: true }
  const updated = await prisma.arenaPlayer.update({ where: { id: player.id }, data: { teamId: fixed } })
  return { player: updated, locked: true }
}

function teamView(team: TeamSummary | null) {
  return team ? { id: team.id, slug: team.slug, name: team.name, school: team.school, color: team.teamColor } : null
}

function statsView(p: Pick<ArenaPlayer, 'matches' | 'wins' | 'roundsWon' | 'knockouts' | 'damage' | 'currentStreak' | 'bestStreak'>) {
  return {
    matches: p.matches,
    wins: p.wins,
    losses: p.matches - p.wins,
    winRate: p.matches ? Math.round((p.wins / p.matches) * 100) : 0,
    roundsWon: p.roundsWon,
    knockouts: p.knockouts,
    damage: p.damage,
    currentStreak: p.currentStreak,
    bestStreak: p.bestStreak,
  }
}

/** Position on the all-time board: wins first, knockouts break ties. */
async function allTimeRank(p: Pick<ArenaPlayer, 'wins' | 'knockouts' | 'matches'>): Promise<number | null> {
  if (!p.matches) return null
  const ahead = await prisma.arenaPlayer.count({
    where: { OR: [{ wins: { gt: p.wins } }, { wins: p.wins, knockouts: { gt: p.knockouts } }] },
  })
  return ahead + 1
}

async function recentMatches(playerId: string, take = 10) {
  const rows = await prisma.arenaMatch.findMany({
    where: { playerId, finishedAt: { not: null } },
    orderBy: { finishedAt: 'desc' },
    take,
    select: { id: true, mode: true, fighter: true, opponents: true, finishedAt: true, win: true, roundsWon: true, knockouts: true, damage: true },
  })
  return rows.map((m) => ({ ...m, won: m.win === 1 }))
}

/** The fighter each player has won the most with; a profile shows it as their main. */
async function favouriteFighter(playerId: string): Promise<string | null> {
  const rows = await prisma.arenaMatch.groupBy({
    by: ['fighter'],
    where: { playerId, finishedAt: { not: null }, fighter: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { fighter: 'desc' } },
    take: 1,
  })
  return rows[0]?.fighter ?? null
}

/** Everything the game shows on the signed-in player's own profile. */
export async function describeSelf(player: ArenaPlayer) {
  const { player: synced, locked } = await syncTeam(player)
  const [team, rank, recent, fighter] = await Promise.all([
    synced.teamId ? prisma.fundraiserTeam.findUnique({ where: { id: synced.teamId }, select: teamSelect }) : null,
    allTimeRank(synced),
    recentMatches(synced.id),
    favouriteFighter(synced.id),
  ])
  const nextTeamChange = !locked && synced.teamChangedAt ? new Date(synced.teamChangedAt.getTime() + TEAM_CHANGE_DAYS * 86_400_000) : null
  return {
    player: {
      id: synced.id,
      handle: synced.handle,
      team: teamView(team),
      teamLocked: locked,
      teamChangeAvailableAt: nextTeamChange && nextTeamChange > new Date() ? nextTeamChange : null,
      favouriteFighter: fighter,
      rank,
      stats: statsView(synced),
      memberSince: synced.createdAt,
      lastPlayedAt: synced.lastPlayedAt,
    },
    recentMatches: recent,
  }
}

/** A player's public profile by handle: no account details, only what the boards already show. */
export async function describePublic(handle: string) {
  const player = await prisma.arenaPlayer.findUnique({
    where: { handleKey: handleKey(handle) },
    include: { team: { select: teamSelect } },
  })
  if (!player) throw new ArenaGameError('No fighter by that name.', 404)
  const [rank, recent, fighter] = await Promise.all([allTimeRank(player), recentMatches(player.id), favouriteFighter(player.id)])
  return {
    player: {
      handle: player.handle,
      team: teamView(player.team),
      favouriteFighter: fighter,
      rank,
      stats: statsView(player),
      memberSince: player.createdAt,
      lastPlayedAt: player.lastPlayedAt,
    },
    recentMatches: recent,
  }
}

/** The groups a player can choose to fight for: every group in an active fundraiser battle. */
export async function listTeams() {
  const teams = await prisma.fundraiserTeam.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: teamSelect,
  })
  return teams.map(teamView)
}

/**
 * Rename the player or move them to another group. A group that comes from the account cannot
 * be changed here, and a chosen one only every TEAM_CHANGE_DAYS, so nobody hops between groups
 * to lift one up the team board.
 */
export async function updateSelf(player: ArenaPlayer, input: { handle?: string; teamId?: string | null }) {
  const data: Prisma.ArenaPlayerUpdateInput = {}
  if (input.handle !== undefined) {
    const parsed = HandleSchema.safeParse(input.handle)
    if (!parsed.success) throw new ArenaGameError(parsed.error.issues[0]?.message || 'That name cannot be used.', 400)
    data.handle = parsed.data
    data.handleKey = handleKey(parsed.data)
  }
  if (input.teamId !== undefined && input.teamId !== player.teamId) {
    const { locked } = await syncTeam(player)
    if (locked) throw new ArenaGameError('Your group comes from your fundraiser account, so it cannot be changed here.', 409, 'rejected')
    if (player.teamChangedAt && Date.now() - player.teamChangedAt.getTime() < TEAM_CHANGE_DAYS * 86_400_000) {
      throw new ArenaGameError(`You can change your group once every ${TEAM_CHANGE_DAYS} days.`, 409, 'rejected')
    }
    if (input.teamId) {
      const team = await prisma.fundraiserTeam.findUnique({ where: { id: input.teamId }, select: { status: true } })
      if (!team || team.status !== 'ACTIVE') throw new ArenaGameError('That group is not in an active fundraiser.', 400)
    }
    data.team = input.teamId ? { connect: { id: input.teamId } } : { disconnect: true }
    data.teamChangedAt = new Date()
  }
  try {
    const updated = await prisma.arenaPlayer.update({ where: { id: player.id }, data })
    return describeSelf(updated)
  } catch (error) {
    if (isUniqueViolation(error)) throw new ArenaGameError('Another fighter already has that name.', 409, 'rejected')
    throw error
  }
}
