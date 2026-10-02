/**
 * Jose Madrid's controls for the mobile fundraiser app, per group: turn it on, issue the group ID,
 * set the group PIN, and give one seller the organizer seat.
 */
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { PinSchema, generateGroupCode, hashPin, isLocked } from './credentials'
import { FundraiserAppError } from './errors'

export const AppSettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    /** Issue a new group ID. Phones already signed in stay signed in; new sign-ups need the new ID. */
    regenerateCode: z.literal(true).optional(),
    groupPin: PinSchema.optional(),
    /** The seller who holds the organizer seat, or null to leave it empty. */
    organizerId: z.string().min(1).max(64).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to change')

export type AppSettingsUpdate = z.infer<typeof AppSettingsUpdateSchema>

export async function getAppSettings(fundraiserId: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id: fundraiserId },
    select: {
      id: true,
      name: true,
      organizationName: true,
      appEnabled: true,
      appGroupCode: true,
      appGroupPinHash: true,
      appGroupLockedUntil: true,
      appOrganizerId: true,
      participants: {
        orderBy: [{ lastName: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          appPinHash: true,
          appPinSetAt: true,
          appPinLockedUntil: true,
          appSessions: {
            where: { revokedAt: null },
            orderBy: { lastSeenAt: 'desc' },
            select: { id: true, deviceName: true, platform: true, lastSeenAt: true },
          },
        },
      },
    },
  })
  if (!fundraiser) throw new FundraiserAppError('Fundraiser not found', 404)

  return {
    id: fundraiser.id,
    name: fundraiser.name,
    organizationName: fundraiser.organizationName,
    enabled: fundraiser.appEnabled,
    groupCode: fundraiser.appGroupCode,
    hasGroupPin: !!fundraiser.appGroupPinHash,
    groupLocked: isLocked(fundraiser.appGroupLockedUntil),
    organizerId: fundraiser.appOrganizerId,
    sellers: fundraiser.participants.map((seller) => ({
      id: seller.id,
      name: seller.name,
      email: seller.email,
      active: seller.status === 'ACTIVE',
      hasPin: !!seller.appPinHash,
      pinSetAt: seller.appPinSetAt,
      lockedOut: isLocked(seller.appPinLockedUntil),
      devices: seller.appSessions,
    })),
  }
}

export type AppSettings = Awaited<ReturnType<typeof getAppSettings>>

async function uniqueGroupCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateGroupCode()
    const taken = await prisma.fundraiser.findUnique({ where: { appGroupCode: code }, select: { id: true } })
    if (!taken) return code
  }
  throw new Error('Could not find a free group ID')
}

export async function updateAppSettings(fundraiserId: string, update: AppSettingsUpdate) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id: fundraiserId },
    select: { id: true, appGroupCode: true, appGroupPinHash: true },
  })
  if (!fundraiser) throw new FundraiserAppError('Fundraiser not found', 404)

  const data: Prisma.FundraiserUpdateInput = {}

  // Turning the app on issues a group ID if the group does not have one yet.
  if (update.regenerateCode || (update.enabled && !fundraiser.appGroupCode)) {
    data.appGroupCode = await uniqueGroupCode()
  }
  if (update.groupPin) {
    data.appGroupPinHash = await hashPin(update.groupPin)
    data.appGroupPinFailures = 0
    data.appGroupLockedUntil = null
  }
  if (update.enabled !== undefined) {
    if (update.enabled && !fundraiser.appGroupPinHash && !update.groupPin) {
      throw new FundraiserAppError('Set a group PIN before turning the app on.', 400)
    }
    data.appEnabled = update.enabled
  }
  if (update.organizerId !== undefined) {
    if (update.organizerId) {
      const seller = await prisma.fundraiserParticipant.findFirst({
        where: { id: update.organizerId, fundraiserId },
        select: { id: true },
      })
      if (!seller) throw new FundraiserAppError('That seller is not part of this fundraiser.', 400)
      data.appOrganizer = { connect: { id: seller.id } }
    } else {
      data.appOrganizer = { disconnect: true }
    }
  }

  await prisma.fundraiser.update({ where: { id: fundraiserId }, data })
}

/** Sign one phone out, or every phone a seller has when `sessionId` is omitted. */
export async function revokeSellerDevices(fundraiserId: string, sellerId: string, sessionId?: string) {
  const seller = await prisma.fundraiserParticipant.findFirst({
    where: { id: sellerId, fundraiserId },
    select: { id: true },
  })
  if (!seller) throw new FundraiserAppError('Seller not found', 404)

  const result = await prisma.fundraiserAppSession.updateMany({
    where: { participantId: seller.id, revokedAt: null, ...(sessionId ? { id: sessionId } : {}) },
    data: { revokedAt: new Date() },
  })
  return result.count
}
