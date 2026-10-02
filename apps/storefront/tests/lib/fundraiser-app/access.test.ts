import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashPin, hashSessionToken } from '@/lib/fundraiser-app/credentials'

const db = vi.hoisted(() => ({
  fundraiser: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  fundraiserParticipant: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  fundraiserAppSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  order: { aggregate: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))
vi.mock('@/lib/fundraisers/referral-code', () => ({
  generateUniqueReferralCode: vi.fn().mockResolvedValue('FR-TEST-0001'),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIdentifier: () => '127.0.0.1',
}))

const {
  registerSeller,
  reclaimSeller,
  requireAppSession,
  unlockSession,
  verifyGroupCredentials,
  listRoster,
} = await import('@/lib/fundraiser-app/access')
const { FundraiserAppError } = await import('@/lib/fundraiser-app/errors')

const GROUP_PIN = '4321'
const SELLER_PIN = '2468'
let groupPinHash: string
let sellerPinHash: string

const group = (overrides: Record<string, unknown> = {}) => ({
  id: 'f_1',
  slug: 'zhs-band',
  name: 'Spring Salsa Drive',
  organizationName: 'Zanesville High Band',
  logoUrl: null,
  startDate: new Date('2026-10-01'),
  endDate: new Date('2026-11-01'),
  status: 'ACTIVE',
  isActive: true,
  appEnabled: true,
  appGroupPinHash: groupPinHash,
  appGroupPinFailures: 0,
  appGroupLockedUntil: null,
  appOrganizerId: null,
  ...overrides,
})

const credentials = { groupCode: 'K7Q4MZ', groupPin: GROUP_PIN }

async function expectAppError(promise: Promise<unknown>, status: number) {
  const error = await promise.catch((e) => e)
  expect(error).toBeInstanceOf(FundraiserAppError)
  expect(error.status).toBe(status)
  return error as InstanceType<typeof FundraiserAppError>
}

beforeEach(async () => {
  vi.clearAllMocks()
  groupPinHash ??= await hashPin(GROUP_PIN)
  sellerPinHash ??= await hashPin(SELLER_PIN)
  db.fundraiser.findUnique.mockResolvedValue(group())
  db.fundraiser.update.mockResolvedValue({ appGroupPinFailures: 1 })
  db.fundraiserParticipant.update.mockResolvedValue({ appPinFailures: 1 })
  db.fundraiserAppSession.create.mockResolvedValue({})
})

describe('verifyGroupCredentials', () => {
  it('accepts the right group ID and PIN', async () => {
    await expect(verifyGroupCredentials(credentials)).resolves.toMatchObject({ id: 'f_1' })
    expect(db.fundraiser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { appGroupCode: 'K7Q4MZ' } })
    )
  })

  it('gives the same answer for an unknown group as for a wrong PIN', async () => {
    db.fundraiser.findUnique.mockResolvedValueOnce(null)
    const unknown = await expectAppError(verifyGroupCredentials(credentials), 401)
    const wrong = await expectAppError(verifyGroupCredentials({ ...credentials, groupPin: '0000' }), 401)
    expect(unknown.message).toBe(wrong.message)
  })

  it('counts a wrong PIN atomically and locks sign-ups once there are too many', async () => {
    db.fundraiser.update.mockResolvedValueOnce({ appGroupPinFailures: 1 })
    await expectAppError(verifyGroupCredentials({ ...credentials, groupPin: '0000' }), 401)
    expect(db.fundraiser.update).toHaveBeenCalledWith({
      where: { id: 'f_1' },
      data: { appGroupPinFailures: { increment: 1 } },
      select: { appGroupPinFailures: true },
    })
    expect(db.fundraiser.updateMany).not.toHaveBeenCalled()

    db.fundraiser.update.mockResolvedValueOnce({ appGroupPinFailures: 25 })
    await expectAppError(verifyGroupCredentials({ ...credentials, groupPin: '0000' }), 401)
    expect(db.fundraiser.updateMany).toHaveBeenCalledWith({
      where: { id: 'f_1', appGroupPinFailures: { gte: 25 } },
      data: { appGroupPinFailures: 0, appGroupLockedUntil: expect.any(Date) },
    })
  })

  it('refuses even the right PIN while locked', async () => {
    db.fundraiser.findUnique.mockResolvedValueOnce(group({ appGroupLockedUntil: new Date(Date.now() + 60_000) }))
    await expectAppError(verifyGroupCredentials(credentials), 429)
  })

  it('refuses a group the admin has not turned on, deactivated, or whose campaign ended', async () => {
    db.fundraiser.findUnique.mockResolvedValueOnce(group({ appEnabled: false }))
    await expectAppError(verifyGroupCredentials(credentials), 403)
    db.fundraiser.findUnique.mockResolvedValueOnce(group({ isActive: false }))
    await expectAppError(verifyGroupCredentials(credentials), 403)
    db.fundraiser.findUnique.mockResolvedValueOnce(group({ status: 'ENDED' }))
    await expectAppError(verifyGroupCredentials(credentials), 403)
  })
})

describe('listRoster', () => {
  it('lists names with whether each has a PIN, never the hash', async () => {
    db.fundraiserParticipant.findMany.mockResolvedValue([
      { id: 'p_1', name: 'Casey Jones', appPinHash: sellerPinHash },
      { id: 'p_2', name: 'Riley Smith', appPinHash: null },
    ])
    const roster = await listRoster(credentials)
    expect(roster).toEqual([
      { id: 'p_1', name: 'Casey Jones', hasPin: true },
      { id: 'p_2', name: 'Riley Smith', hasPin: false },
    ])
  })
})

describe('registerSeller', () => {
  const input = { ...credentials, firstName: ' casey ', lastName: 'jones', pin: SELLER_PIN, platform: 'ios' as const }

  it('creates a seller from their name and signs the phone in', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue(null)
    db.fundraiserParticipant.create.mockResolvedValue({ id: 'p_new' })

    const result = await registerSeller(input)

    const created = db.fundraiserParticipant.create.mock.calls[0][0].data
    expect(created).toMatchObject({
      fundraiserId: 'f_1',
      name: 'Casey Jones',
      firstName: 'Casey',
      lastName: 'Jones',
      referralCode: 'FR-TEST-0001',
    })
    expect(created.email).toBeUndefined()
    expect(created.appPinHash).not.toBe(SELLER_PIN)

    expect(result.sellerId).toBe('p_new')
    const session = db.fundraiserAppSession.create.mock.calls[0][0].data
    expect(session).toMatchObject({ participantId: 'p_new', platform: 'ios' })
    expect(session.tokenHash).toBe(hashSessionToken(result.token))
  })

  it('claims a seller the organizer added who has not set up the app', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue({ id: 'p_old', status: 'ACTIVE', appPinHash: null })
    db.fundraiserParticipant.update.mockResolvedValue({ id: 'p_old' })

    const result = await registerSeller(input)

    expect(db.fundraiserParticipant.create).not.toHaveBeenCalled()
    expect(db.fundraiserParticipant.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'p_old' },
      data: { firstName: 'Casey', lastName: 'Jones' },
    })
    expect(result.sellerId).toBe('p_old')
  })

  it('sends a seller who already has a PIN to "I already joined"', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue({ id: 'p_old', status: 'ACTIVE', appPinHash: sellerPinHash })
    const error = await expectAppError(registerSeller(input), 409)
    expect(error.message).toContain('I already joined')
    expect(db.fundraiserAppSession.create).not.toHaveBeenCalled()
  })
})

describe('reclaimSeller', () => {
  const seller = (overrides: Record<string, unknown> = {}) => ({
    id: 'p_1',
    status: 'ACTIVE',
    appPinHash: sellerPinHash,
    appPinFailures: 0,
    appPinLockedUntil: null,
    ...overrides,
  })
  const input = { ...credentials, participantId: 'p_1', pin: SELLER_PIN }

  it('signs a seller back in with their own PIN', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue(seller())
    const result = await reclaimSeller(input)
    expect(result.pinWasSet).toBe(false)
    expect(db.fundraiserAppSession.create).toHaveBeenCalledOnce()
  })

  it('looks the seller up inside the group the PIN unlocked', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue(null)
    await expectAppError(reclaimSeller(input), 404)
    expect(db.fundraiserParticipant.findFirst.mock.calls[0][0].where).toEqual({ id: 'p_1', fundraiserId: 'f_1' })
  })

  it('counts a wrong PIN atomically and locks the seller out after five', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue(seller())
    db.fundraiserParticipant.update.mockResolvedValueOnce({ appPinFailures: 1 })
    await expectAppError(reclaimSeller({ ...input, pin: '0000' }), 401)
    expect(db.fundraiserParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p_1' },
      data: { appPinFailures: { increment: 1 } },
      select: { appPinFailures: true },
    })

    db.fundraiserParticipant.update.mockResolvedValueOnce({ appPinFailures: 5 })
    await expectAppError(reclaimSeller({ ...input, pin: '0000' }), 429)
    expect(db.fundraiserParticipant.updateMany).toHaveBeenCalledWith({
      where: { id: 'p_1', appPinFailures: { gte: 5 } },
      data: { appPinFailures: 0, appPinLockedUntil: expect.any(Date) },
    })
    expect(db.fundraiserAppSession.create).not.toHaveBeenCalled()
  })

  it('refuses while locked out', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue(seller({ appPinLockedUntil: new Date(Date.now() + 60_000) }))
    await expectAppError(reclaimSeller(input), 429)
  })

  it('lets a seller whose PIN was reset choose a new one', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue(seller({ appPinHash: null }))
    const result = await reclaimSeller({ ...input, pin: '9753' })
    expect(result.pinWasSet).toBe(true)
    expect(db.fundraiserParticipant.update.mock.calls[0][0].data.appPinHash).toEqual(expect.any(String))
  })
})

describe('requireAppSession', () => {
  const token = 'device-token'
  const request = () => new Request('http://localhost/api/fundraiser-app/me', { headers: { authorization: `Bearer ${token}` } })
  const session = (overrides: Record<string, unknown> = {}, participant: Record<string, unknown> = {}) => ({
    id: 's_1',
    revokedAt: null,
    unlockedAt: new Date(),
    lastSeenAt: new Date(),
    participant: {
      id: 'p_1',
      name: 'Casey Jones',
      status: 'ACTIVE',
      appPinHash: sellerPinHash,
      appPinFailures: 0,
      appPinLockedUntil: null,
      fundraiser: group(),
      ...participant,
    },
    ...overrides,
  })

  it('finds the session by the hash of the device token', async () => {
    db.fundraiserAppSession.findUnique.mockResolvedValue(session())
    await expect(requireAppSession(request(), { unlocked: true })).resolves.toMatchObject({ id: 's_1' })
    expect(db.fundraiserAppSession.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashSessionToken(token) })
  })

  it('signs out a missing token, a revoked session, and a seller whose PIN was reset', async () => {
    const bare = new Request('http://localhost/api/fundraiser-app/me')
    expect((await expectAppError(requireAppSession(bare), 401)).code).toBe('signed_out')

    db.fundraiserAppSession.findUnique.mockResolvedValueOnce(session({ revokedAt: new Date() }))
    expect((await expectAppError(requireAppSession(request()), 401)).code).toBe('signed_out')

    db.fundraiserAppSession.findUnique.mockResolvedValueOnce(session({}, { appPinHash: null }))
    expect((await expectAppError(requireAppSession(request()), 401)).code).toBe('signed_out')
  })

  it('asks for the PIN again once the unlock has run out', async () => {
    db.fundraiserAppSession.findUnique.mockResolvedValue(session({ unlockedAt: new Date(Date.now() - 13 * 3_600_000) }))
    await expect(requireAppSession(request())).resolves.toBeTruthy()
    expect((await expectAppError(requireAppSession(request(), { unlocked: true }), 401)).code).toBe('locked')
  })

  it('shuts every phone out when the admin turns the app off', async () => {
    db.fundraiserAppSession.findUnique.mockResolvedValue(session({}, { fundraiser: group({ appEnabled: false }) }))
    expect((await expectAppError(requireAppSession(request()), 403)).code).toBe('group_closed')
  })
})

describe('unlockSession', () => {
  const appSession = () =>
    ({
      id: 's_1',
      participant: { id: 'p_1', appPinHash: sellerPinHash, appPinFailures: 2, appPinLockedUntil: null },
    }) as unknown as Parameters<typeof unlockSession>[0]

  it('unlocks with the right PIN and clears earlier misses', async () => {
    await unlockSession(appSession(), SELLER_PIN)
    expect(db.fundraiserParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p_1' },
      data: { appPinFailures: 0, appPinLockedUntil: null },
    })
    expect(db.fundraiserAppSession.update).toHaveBeenCalledWith({
      where: { id: 's_1' },
      data: { unlockedAt: expect.any(Date) },
    })
  })

  it('does not unlock with the wrong PIN', async () => {
    db.fundraiserParticipant.update.mockResolvedValueOnce({ appPinFailures: 3 })
    await expectAppError(unlockSession(appSession(), '1111'), 401)
    expect(db.fundraiserAppSession.update).not.toHaveBeenCalled()
  })
})
