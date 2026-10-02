/**
 * Who may use the mobile fundraiser app, and how they get in.
 *
 *   Join      group ID + group PIN + first and last name + a new personal PIN → a device token
 *   Reclaim   group ID + group PIN + pick your name + your personal PIN        → a device token
 *   Unlock    device token + personal PIN, every time the app opens
 *
 * A Jose Madrid admin issues the group ID and turns the app on (admin › Fundraisers › Mobile
 * app). The group PIN is set there or by the group's organizer, who holds the one organizer seat
 * per group and is the only seller who can reset another seller's PIN.
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { generateUniqueReferralCode } from '@/lib/fundraisers/referral-code'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter'
import {
  GROUP_PIN_LOCK_MINUTES,
  GROUP_PIN_MAX_FAILURES,
  GroupCodeSchema,
  PinSchema,
  SELLER_PIN_LOCK_MINUTES,
  SELLER_PIN_MAX_FAILURES,
  SellerNameSchema,
  cleanName,
  displayName,
  hashPin,
  hashSessionToken,
  isLocked,
  isUnlocked,
  newSessionToken,
  nextLockout,
  verifyPin,
} from './credentials'
import { FundraiserAppError } from './errors'

const DeviceSchema = z.object({
  deviceName: z.string().trim().max(100).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
})

export const GroupCredentialsSchema = z.object({
  groupCode: GroupCodeSchema,
  groupPin: PinSchema,
})

export const RegisterSchema = GroupCredentialsSchema.merge(SellerNameSchema)
  .merge(DeviceSchema)
  .extend({ pin: PinSchema })

export const ReclaimSchema = GroupCredentialsSchema.merge(DeviceSchema).extend({
  participantId: z.string().min(1).max(64),
  pin: PinSchema,
})

export const UnlockSchema = z.object({ pin: PinSchema })

const groupSelect = {
  id: true,
  slug: true,
  name: true,
  organizationName: true,
  logoUrl: true,
  startDate: true,
  endDate: true,
  status: true,
  isActive: true,
  appEnabled: true,
  appCardPayments: true,
  appGroupPinHash: true,
  appGroupPinFailures: true,
  appGroupLockedUntil: true,
  appOrganizerId: true,
} as const

/** The group as the app shows it. Never includes a hash. */
export interface AppGroup {
  id: string
  name: string
  organizationName: string
  logoUrl: string | null
  startDate: Date
  endDate: Date
}

function publicGroup(fundraiser: AppGroup): AppGroup {
  const { id, name, organizationName, logoUrl, startDate, endDate } = fundraiser
  return { id, name, organizationName, logoUrl, startDate, endDate }
}

/** Ended and cancelled campaigns take no more orders, so the app stops working with them. */
function isOpenForApp(fundraiser: { appEnabled: boolean; status: string }): boolean {
  return fundraiser.appEnabled && fundraiser.status !== 'ENDED' && fundraiser.status !== 'CANCELLED'
}

/**
 * A backstop on the routes that take a group PIN, per network address. Generous, because a whole
 * class may set the app up at once from one school network; the per-group and per-seller lockouts
 * are what stop guessing.
 */
export async function limitCredentialAttempts(request: Request) {
  const result = await checkRateLimit({
    identifier: `fundraiser-app:${getClientIdentifier(request)}`,
    maxRequests: 150,
    windowSeconds: 15 * 60,
  })
  if (!result.allowed) {
    throw new FundraiserAppError('Too many attempts from this network. Wait a few minutes, then try again.', 429)
  }
}

const WRONG_GROUP = 'That group ID and PIN do not match. Check them with your organizer.'

/**
 * Check a group ID and group PIN. The same message covers an unknown group and a wrong PIN, so
 * the endpoint cannot be used to discover which group IDs exist.
 */
export async function verifyGroupCredentials(input: { groupCode: string; groupPin: string }) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { appGroupCode: input.groupCode },
    select: groupSelect,
  })

  if (!fundraiser || !fundraiser.appGroupPinHash) {
    throw new FundraiserAppError(WRONG_GROUP, 401)
  }
  if (isLocked(fundraiser.appGroupLockedUntil)) {
    throw new FundraiserAppError(
      'Too many wrong group PINs. Wait a few minutes, then try again.',
      429
    )
  }

  if (!(await verifyPin(input.groupPin, fundraiser.appGroupPinHash))) {
    const next = nextLockout(fundraiser.appGroupPinFailures, {
      maxFailures: GROUP_PIN_MAX_FAILURES,
      lockMinutes: GROUP_PIN_LOCK_MINUTES,
    })
    await prisma.fundraiser.update({
      where: { id: fundraiser.id },
      data: { appGroupPinFailures: next.failures, appGroupLockedUntil: next.lockedUntil },
    })
    throw new FundraiserAppError(WRONG_GROUP, 401)
  }

  if (!isOpenForApp(fundraiser)) {
    throw new FundraiserAppError(
      'This fundraiser is not taking orders in the app right now. Ask your organizer.',
      403
    )
  }

  if (fundraiser.appGroupPinFailures > 0) {
    await prisma.fundraiser.update({
      where: { id: fundraiser.id },
      data: { appGroupPinFailures: 0 },
    })
  }

  return fundraiser
}

/** Step one of setup: is this the right group? */
export async function checkGroup(input: z.infer<typeof GroupCredentialsSchema>) {
  return publicGroup(await verifyGroupCredentials(input))
}

/** The names a seller picks from when they need to get back into the app. */
export async function listRoster(input: z.infer<typeof GroupCredentialsSchema>) {
  const fundraiser = await verifyGroupCredentials(input)
  const sellers = await prisma.fundraiserParticipant.findMany({
    where: { fundraiserId: fundraiser.id, status: 'ACTIVE' },
    orderBy: [{ lastName: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, appPinHash: true },
  })
  return sellers.map((seller) => ({
    id: seller.id,
    name: seller.name,
    // A seller whose PIN the organizer reset chooses a new one when they reclaim.
    hasPin: !!seller.appPinHash,
  }))
}

async function startSession(
  participantId: string,
  device: z.infer<typeof DeviceSchema>
): Promise<string> {
  const token = newSessionToken()
  await prisma.fundraiserAppSession.create({
    data: {
      participantId,
      tokenHash: hashSessionToken(token),
      deviceName: device.deviceName,
      platform: device.platform,
      // The seller just typed their PIN, so the app opens unlocked.
      unlockedAt: new Date(),
    },
  })
  return token
}

/**
 * First-time setup. The name either is new to the group, or belongs to a seller the organizer or
 * Jose Madrid added who has not set up the app yet — in which case this claims that record, so
 * their earlier sales stay theirs.
 */
export async function registerSeller(input: z.infer<typeof RegisterSchema>) {
  const fundraiser = await verifyGroupCredentials(input)
  const firstName = cleanName(input.firstName)
  const lastName = cleanName(input.lastName)
  const name = displayName(firstName, lastName)

  const existing = await prisma.fundraiserParticipant.findFirst({
    where: {
      fundraiserId: fundraiser.id,
      OR: [
        {
          firstName: { equals: firstName, mode: 'insensitive' },
          lastName: { equals: lastName, mode: 'insensitive' },
        },
        { name: { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true, status: true, appPinHash: true },
  })

  if (existing?.appPinHash) {
    throw new FundraiserAppError(
      `${name} is already signed up. Tap "I already joined" to get back in, or add a middle initial if this is someone else.`,
      409
    )
  }
  if (existing && existing.status !== 'ACTIVE') {
    throw new FundraiserAppError('Your seller account is turned off. Ask your organizer.', 403)
  }

  const pinHash = await hashPin(input.pin)
  const now = new Date()
  const seller = existing
    ? await prisma.fundraiserParticipant.update({
        where: { id: existing.id },
        data: { firstName, lastName, appPinHash: pinHash, appPinSetAt: now },
        select: { id: true },
      })
    : await prisma.fundraiserParticipant.create({
        data: {
          fundraiserId: fundraiser.id,
          name,
          firstName,
          lastName,
          referralCode: await generateUniqueReferralCode(),
          appPinHash: pinHash,
          appPinSetAt: now,
        },
        select: { id: true },
      })

  const token = await startSession(seller.id, input)
  return { token, group: publicGroup(fundraiser), sellerId: seller.id }
}

/** Count a wrong personal PIN against the seller, locking them out after too many. */
async function recordWrongSellerPin(participant: { id: string; appPinFailures: number }) {
  const next = nextLockout(participant.appPinFailures, {
    maxFailures: SELLER_PIN_MAX_FAILURES,
    lockMinutes: SELLER_PIN_LOCK_MINUTES,
  })
  await prisma.fundraiserParticipant.update({
    where: { id: participant.id },
    data: { appPinFailures: next.failures, appPinLockedUntil: next.lockedUntil },
  })
  return next.lockedUntil
    ? new FundraiserAppError(
        `Too many wrong PINs. Try again in ${SELLER_PIN_LOCK_MINUTES} minutes, or ask your organizer to reset your PIN.`,
        429
      )
    : new FundraiserAppError('That PIN is not right. Try again.', 401)
}

async function clearSellerPinFailures(participant: { id: string; appPinFailures: number }) {
  if (participant.appPinFailures === 0) return
  await prisma.fundraiserParticipant.update({
    where: { id: participant.id },
    data: { appPinFailures: 0, appPinLockedUntil: null },
  })
}

const LOCKED_OUT = `Too many wrong PINs. Try again in ${SELLER_PIN_LOCK_MINUTES} minutes, or ask your organizer to reset your PIN.`

/**
 * Get back into the app on a new phone, after reinstalling, or after a PIN reset. A seller with
 * a PIN must enter it; a seller whose PIN was reset sets the new one here.
 */
export async function reclaimSeller(input: z.infer<typeof ReclaimSchema>) {
  const fundraiser = await verifyGroupCredentials(input)
  const seller = await prisma.fundraiserParticipant.findFirst({
    where: { id: input.participantId, fundraiserId: fundraiser.id },
    select: { id: true, status: true, appPinHash: true, appPinFailures: true, appPinLockedUntil: true },
  })

  if (!seller) throw new FundraiserAppError('Pick your name from the list.', 404)
  if (seller.status !== 'ACTIVE') {
    throw new FundraiserAppError('Your seller account is turned off. Ask your organizer.', 403)
  }
  if (isLocked(seller.appPinLockedUntil)) throw new FundraiserAppError(LOCKED_OUT, 429)

  if (seller.appPinHash) {
    if (!(await verifyPin(input.pin, seller.appPinHash))) throw await recordWrongSellerPin(seller)
    await clearSellerPinFailures(seller)
  } else {
    await prisma.fundraiserParticipant.update({
      where: { id: seller.id },
      data: { appPinHash: await hashPin(input.pin), appPinSetAt: new Date() },
    })
  }

  const token = await startSession(seller.id, input)
  return { token, group: publicGroup(fundraiser), sellerId: seller.id, pinWasSet: !seller.appPinHash }
}

const sessionInclude = {
  participant: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      status: true,
      referralCode: true,
      appPinHash: true,
      appPinFailures: true,
      appPinLockedUntil: true,
      fundraiser: { select: groupSelect },
    },
  },
} as const

export type AppSession = NonNullable<Awaited<ReturnType<typeof findSession>>>

function findSession(tokenHash: string) {
  return prisma.fundraiserAppSession.findUnique({ where: { tokenHash }, include: sessionInclude })
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() || null : null
}

const SIGNED_OUT = 'You have been signed out. Tap "I already joined" to get back in.'

/**
 * The signed-in seller behind a request. With `unlocked`, the seller must also have entered
 * their PIN recently — every route that reads or writes orders asks for that.
 */
export async function requireAppSession(
  request: Request,
  options: { unlocked?: boolean } = {}
): Promise<AppSession> {
  const token = bearerToken(request)
  if (!token) throw new FundraiserAppError(SIGNED_OUT, 401, 'signed_out')

  const session = await findSession(hashSessionToken(token))
  if (!session || session.revokedAt) throw new FundraiserAppError(SIGNED_OUT, 401, 'signed_out')

  const { participant } = session
  // A reset PIN signs every phone out, so a session without a PIN behind it is not one.
  if (!participant.appPinHash || participant.status !== 'ACTIVE') {
    throw new FundraiserAppError(SIGNED_OUT, 401, 'signed_out')
  }
  if (!isOpenForApp(participant.fundraiser)) {
    throw new FundraiserAppError(
      'This fundraiser is not taking orders in the app right now.',
      403,
      'group_closed'
    )
  }
  if (options.unlocked && !isUnlocked(session.unlockedAt)) {
    throw new FundraiserAppError('Enter your PIN to continue.', 401, 'locked')
  }

  // Bookkeeping only: at most one write per few minutes per phone.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.fundraiserAppSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
  }

  return session
}

/** The personal PIN, asked for every time the app opens. */
export async function unlockSession(session: AppSession, pin: string) {
  const seller = session.participant
  if (isLocked(seller.appPinLockedUntil)) throw new FundraiserAppError(LOCKED_OUT, 429)
  if (!(await verifyPin(pin, seller.appPinHash))) throw await recordWrongSellerPin(seller)

  await clearSellerPinFailures(seller)
  await prisma.fundraiserAppSession.update({
    where: { id: session.id },
    data: { unlockedAt: new Date() },
  })
}

export async function signOutSession(session: AppSession) {
  await prisma.fundraiserAppSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  })
}

/** The seller's own view: who they are, their group, and whether they hold the organizer seat. */
export async function describeSeller(session: AppSession) {
  const { participant } = session
  const totals = await prisma.order.aggregate({
    where: { participantId: participant.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    _count: { _all: true },
    _sum: { total: true },
  })
  return {
    seller: {
      id: participant.id,
      name: participant.name,
      firstName: participant.firstName,
      lastName: participant.lastName,
      referralCode: participant.referralCode,
      isOrganizer: participant.fundraiser.appOrganizerId === participant.id,
    },
    group: { ...publicGroup(participant.fundraiser), cardPayments: participant.fundraiser.appCardPayments },
    stats: {
      orders: totals._count._all,
      sales: Number(totals._sum.total ?? 0),
    },
  }
}
