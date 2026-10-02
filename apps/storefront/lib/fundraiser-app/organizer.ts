/**
 * The organizer seat. Each group has exactly one (`Fundraiser.appOrganizerId`, assigned by a
 * Jose Madrid admin), and only its holder can reset another seller's PIN or change the group PIN
 * from the app. The organizer's own PIN is reset by Jose Madrid.
 */
import prisma from '@/lib/prisma'
import type { AppSession } from './access'
import { hashPin } from './credentials'
import { FundraiserAppError } from './errors'

export function requireOrganizer(session: AppSession) {
  if (session.participant.fundraiser.appOrganizerId !== session.participant.id) {
    throw new FundraiserAppError('Only your group organizer can do that.', 403)
  }
}

/** Every seller in the group, with what the organizer needs to help them get back in. */
export async function listGroupSellers(session: AppSession) {
  requireOrganizer(session)
  const fundraiserId = session.participant.fundraiser.id
  const [sellers, sales] = await Promise.all([
    prisma.fundraiserParticipant.findMany({
      where: { fundraiserId },
      orderBy: [{ lastName: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        appPinHash: true,
        appPinLockedUntil: true,
        appSessions: { where: { revokedAt: null }, select: { lastSeenAt: true } },
      },
    }),
    prisma.order.groupBy({
      by: ['participantId'],
      where: { fundraiserId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ])
  const salesBySeller = new Map(sales.map((row) => [row.participantId, row]))

  return sellers.map((seller) => {
    const row = salesBySeller.get(seller.id)
    const lastSeen = seller.appSessions.reduce<Date | null>(
      (latest, s) => (!latest || s.lastSeenAt > latest ? s.lastSeenAt : latest),
      null
    )
    return {
      id: seller.id,
      name: seller.name,
      active: seller.status === 'ACTIVE',
      hasPin: !!seller.appPinHash,
      lockedOut: !!seller.appPinLockedUntil && seller.appPinLockedUntil > new Date(),
      devices: seller.appSessions.length,
      lastSeenAt: lastSeen,
      isOrganizer: seller.id === session.participant.fundraiser.appOrganizerId,
      orders: row?._count._all ?? 0,
      sales: Number(row?._sum.total ?? 0),
    }
  })
}

/**
 * Clear a seller's PIN and sign their phones out. They get back in with "I already joined",
 * picking their name and choosing a new PIN.
 */
export async function resetSellerPin(session: AppSession, sellerId: string) {
  requireOrganizer(session)
  if (sellerId === session.participant.id) {
    throw new FundraiserAppError('Ask Jose Madrid Salsa to reset your own PIN.', 403)
  }
  return clearSellerPin(session.participant.fundraiser.id, sellerId)
}

/** Shared with the admin panel, which may reset anyone's PIN, the organizer's included. */
export async function clearSellerPin(fundraiserId: string, sellerId: string) {
  const seller = await prisma.fundraiserParticipant.findFirst({
    where: { id: sellerId, fundraiserId },
    select: { id: true, name: true },
  })
  if (!seller) throw new FundraiserAppError('That seller is not in your group.', 404)

  const now = new Date()
  await prisma.$transaction([
    prisma.fundraiserParticipant.update({
      where: { id: seller.id },
      data: { appPinHash: null, appPinSetAt: null, appPinFailures: 0, appPinLockedUntil: null },
    }),
    prisma.fundraiserAppSession.updateMany({
      where: { participantId: seller.id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ])
  return seller
}

/** A new group PIN for future sign-ups. Phones already signed in stay signed in. */
export async function changeGroupPin(session: AppSession, pin: string) {
  requireOrganizer(session)
  await prisma.fundraiser.update({
    where: { id: session.participant.fundraiser.id },
    data: { appGroupPinHash: await hashPin(pin), appGroupPinFailures: 0, appGroupLockedUntil: null },
  })
}
