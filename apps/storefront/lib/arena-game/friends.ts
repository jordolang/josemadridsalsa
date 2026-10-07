/**
 * Battle Arena game friends: friend requests between players, who of your friends is online
 * and in which private room, and invites into your room.
 *
 *   Add       POST /api/arena/friends {handle}: asks them, or accepts when they already asked you
 *   Remove    DELETE /api/arena/friends/[handle]: unfriends, declines or cancels a request
 *   Check in  POST /api/arena/friends/presence {room}: the game says it is open (and in which
 *             private room) about every 30 seconds and gets the whole friends view back
 *   Invite    POST /api/arena/friends/invites {handle, room}: asks a friend into your room
 *
 * The game has no server of its own (rooms are peer to peer), so this is where friends find
 * each other. Room codes are only ever shown to accepted friends.
 */
import type { ArenaPlayer, Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { ArenaGameError } from './http'
import { HandleSchema, handleKey } from './rules'

/** A friend counts as online when their game checked in this recently. */
export const ONLINE_SECONDS = 90
export const MAX_FRIENDS = 100
/** Requests a player can have waiting on others at once. */
export const MAX_PENDING_REQUESTS = 30
export const INVITE_MINUTES = 10
export const INVITES_PER_MINUTE = 10

/** The game's room codes: five of A-Z (no I or O) and 2-9. */
export const RoomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{5}$/, 'That is not a room code.')
export const AddFriendSchema = z.object({ handle: z.string().min(1).max(40) })
export const PresenceSchema = z.object({ room: RoomCodeSchema.nullable().optional() })
export const InviteSchema = z.object({ handle: z.string().min(1).max(40), room: RoomCodeSchema })

const friendSelect = {
  id: true,
  handle: true,
  seenAt: true,
  room: true,
  team: { select: { name: true, teamColor: true } },
} as const
type FriendRow = Prisma.ArenaPlayerGetPayload<{ select: typeof friendSelect }>

export function isOnline(seenAt: Date | null, now = new Date()): boolean {
  return !!seenAt && now.getTime() - seenAt.getTime() < ONLINE_SECONDS * 1000
}

function friendView(p: FriendRow, now: Date) {
  const online = isOnline(p.seenAt, now)
  return {
    handle: p.handle,
    team: p.team ? { name: p.team.name, color: p.team.teamColor } : null,
    online,
    room: online ? p.room : null,
    lastSeenAt: p.seenAt,
  }
}

async function findByHandle(handle: string): Promise<ArenaPlayer> {
  const parsed = HandleSchema.safeParse(handle)
  const target = parsed.success ? await prisma.arenaPlayer.findUnique({ where: { handleKey: handleKey(parsed.data) } }) : null
  if (!target) throw new ArenaGameError('No fighter by that name. Check the spelling of their in-game name.', 404)
  return target
}

/** The row between two players, whichever of them asked. */
function between(a: string, b: string) {
  return prisma.arenaFriend.findFirst({
    where: { OR: [{ requesterId: a, addresseeId: b }, { requesterId: b, addresseeId: a }] },
  })
}

/** Everything the game's friends panel shows: friends (online first), requests both ways and room invites. */
export async function friendsView(player: Pick<ArenaPlayer, 'id'>, now = new Date()) {
  const [rows, invites] = await Promise.all([
    prisma.arenaFriend.findMany({
      where: { OR: [{ requesterId: player.id }, { addresseeId: player.id }] },
      include: { requester: { select: friendSelect }, addressee: { select: friendSelect } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.arenaRoomInvite.findMany({
      where: { toId: player.id, expiresAt: { gt: now } },
      include: { from: { select: { handle: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])
  const friends: ReturnType<typeof friendView>[] = []
  const incoming: { handle: string; sentAt: Date }[] = []
  const outgoing: { handle: string; sentAt: Date }[] = []
  for (const row of rows) {
    const mine = row.requesterId === player.id
    const other = mine ? row.addressee : row.requester
    if (row.status === 'ACCEPTED') friends.push(friendView(other, now))
    else (mine ? outgoing : incoming).push({ handle: other.handle, sentAt: row.createdAt })
  }
  friends.sort((a, b) => Number(b.online) - Number(a.online) || a.handle.localeCompare(b.handle))
  // one invite per friend (the newest), and only from people who are still friends
  const friendHandles = new Set(friends.map((f) => f.handle))
  const seen = new Set<string>()
  const roomInvites = invites
    .filter((i) => friendHandles.has(i.from.handle) && !seen.has(i.from.handle) && seen.add(i.from.handle))
    .map((i) => ({ from: i.from.handle, room: i.room, sentAt: i.createdAt, expiresAt: i.expiresAt }))
  return { friends, incoming, outgoing, invites: roomInvites, onlineSeconds: ONLINE_SECONDS }
}

/** Ask a player to be friends, or accept when they already asked us. Answers with the new view. */
export async function addFriend(player: ArenaPlayer, handle: string) {
  const target = await findByHandle(handle)
  if (target.id === player.id) throw new ArenaGameError('That is you! Add a friend by their in-game name.', 400, 'rejected')
  const row = await between(player.id, target.id)
  if (row?.status === 'PENDING' && row.addresseeId === player.id) {
    await prisma.arenaFriend.update({ where: { id: row.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } })
  } else if (!row) {
    const [friends, pending] = await Promise.all([
      prisma.arenaFriend.count({ where: { status: 'ACCEPTED', OR: [{ requesterId: player.id }, { addresseeId: player.id }] } }),
      prisma.arenaFriend.count({ where: { status: 'PENDING', requesterId: player.id } }),
    ])
    if (friends >= MAX_FRIENDS) throw new ArenaGameError(`You already have ${MAX_FRIENDS} friends. Remove one to add another.`, 409, 'rejected')
    if (pending >= MAX_PENDING_REQUESTS) throw new ArenaGameError('You have a lot of requests waiting. Wait for some answers first.', 429, 'rate_limited')
    try {
      await prisma.arenaFriend.create({ data: { requesterId: player.id, addresseeId: target.id } })
    } catch (error) {
      // both players asked each other at the same moment: the other request stands
      if ((error as { code?: string }).code !== 'P2002') throw error
    }
  }
  return friendsView(player)
}

/** Unfriend, decline a request or cancel one we sent. Pending invites between the two go too. */
export async function removeFriend(player: ArenaPlayer, handle: string) {
  const target = await findByHandle(handle)
  await prisma.$transaction([
    prisma.arenaFriend.deleteMany({
      where: { OR: [{ requesterId: player.id, addresseeId: target.id }, { requesterId: target.id, addresseeId: player.id }] },
    }),
    prisma.arenaRoomInvite.deleteMany({
      where: { OR: [{ fromId: player.id, toId: target.id }, { fromId: target.id, toId: player.id }] },
    }),
  ])
  return friendsView(player)
}

/** The game checks in: the player is online, and in `room` (a private room) or none. */
export async function checkIn(player: ArenaPlayer, room: string | null) {
  const now = new Date()
  await prisma.arenaPlayer.update({ where: { id: player.id }, data: { seenAt: now, room } })
  // an invite into the room we are in now has done its job
  if (room) await prisma.arenaRoomInvite.deleteMany({ where: { toId: player.id, room } })
  return friendsView(player, now)
}

/** Invite a friend into our private room; they see it on their next check-in. */
export async function inviteFriend(player: ArenaPlayer, handle: string, room: string) {
  const target = await findByHandle(handle)
  const row = await between(player.id, target.id)
  if (row?.status !== 'ACCEPTED') throw new ArenaGameError('You can only invite your friends.', 403, 'rejected')
  const now = new Date()
  const recent = await prisma.arenaRoomInvite.count({ where: { fromId: player.id, createdAt: { gt: new Date(now.getTime() - 60_000) } } })
  if (recent >= INVITES_PER_MINUTE) throw new ArenaGameError('That is a lot of invites. Give your friends a moment to answer.', 429, 'rate_limited')
  await prisma.$transaction([
    prisma.arenaRoomInvite.deleteMany({ where: { fromId: player.id, toId: target.id } }),
    prisma.arenaRoomInvite.create({
      data: { fromId: player.id, toId: target.id, room, expiresAt: new Date(now.getTime() + INVITE_MINUTES * 60_000) },
    }),
  ])
  return { invited: target.handle, room, expiresInMinutes: INVITE_MINUTES }
}
