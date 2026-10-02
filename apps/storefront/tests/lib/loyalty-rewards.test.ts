import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const rewardFindUnique = vi.fn()
const rewardCreate = vi.fn()
const rewardUpdateMany = vi.fn()
const rewardDeleteMany = vi.fn()
const redemptionCount = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    loyaltyReward: {
      findUnique: rewardFindUnique,
      create: rewardCreate,
      updateMany: rewardUpdateMany,
      deleteMany: rewardDeleteMany,
    },
    rewardRedemption: { count: redemptionCount },
  }
  return { prisma: client, default: client }
})

const { createReward, updateReward, deleteReward, setRewardActive, RewardAdminError } = await import(
  '@/lib/loyalty-rewards'
)
const { rewardInputSchema, rewardReturnPercent } = await import('@/lib/loyalty-rewards-schema')

const formInput = {
  name: ' $5 Off ',
  description: 'Get $5 off your next order',
  pointsCost: '500',
  rewardValue: '5',
  minimumTier: 'BRONZE',
  maxRedemptions: '',
  isActive: 'true',
}

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' })

describe('rewardInputSchema', () => {
  it('reads form strings into typed values, blank limit meaning unlimited', () => {
    expect(rewardInputSchema.parse(formInput)).toEqual({
      name: '$5 Off',
      description: 'Get $5 off your next order',
      pointsCost: 500,
      rewardValue: 5,
      minimumTier: 'BRONZE',
      maxRedemptions: null,
      isActive: true,
    })
  })

  it('treats an unchecked box (absent) as inactive', () => {
    const { isActive: _omit, ...rest } = formInput
    expect(rewardInputSchema.parse(rest).isActive).toBe(false)
  })

  it.each([
    [{ pointsCost: '0' }, 'Points cost must be at least 1'],
    [{ pointsCost: '2.5' }, 'Points cost must be a whole number'],
    [{ rewardValue: '0' }, 'Discount must be more than $0'],
    [{ minimumTier: 'DIAMOND' }, 'Pick a tier'],
    [{ name: '  ' }, 'Name is required'],
    [{ maxRedemptions: '0' }, 'Limit must be at least 1'],
  ])('refuses %o', (override, message) => {
    const result = rewardInputSchema.safeParse({ ...formInput, ...override })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(message)
  })
})

describe('rewardReturnPercent', () => {
  it('is the discount as a share of the spend that earned the points', () => {
    expect(rewardReturnPercent(500, 5, 10)).toBe(10)
    expect(rewardReturnPercent(2500, 25, 10)).toBe(10)
    expect(rewardReturnPercent(1000, 5, 10)).toBe(5)
  })
})

describe('reward writes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('always stores a DISCOUNT reward with a two-place decimal value', async () => {
    rewardCreate.mockResolvedValue({ id: 'r1', name: '$5 Off' })
    await createReward(rewardInputSchema.parse({ ...formInput, rewardValue: '4.999' }))
    const data = rewardCreate.mock.calls[0][0].data
    expect(data.rewardType).toBe('DISCOUNT')
    expect(data.rewardValue.toString()).toBe('5')
  })

  it('will not lower the limit below what has already been redeemed', async () => {
    rewardUpdateMany.mockResolvedValue({ count: 0 })
    rewardFindUnique.mockResolvedValue({ usedCount: 7 })
    await expect(
      updateReward('r1', rewardInputSchema.parse({ ...formInput, maxRedemptions: '5' })),
    ).rejects.toThrow('already been redeemed 7 times')
    // The cap is enforced in the write itself, not by a read that could go stale.
    expect(rewardUpdateMany.mock.calls[0][0].where).toEqual({ id: 'r1', usedCount: { lte: 5 } })
  })

  it('reports a vanished reward instead of a Prisma error', async () => {
    rewardUpdateMany.mockResolvedValue({ count: 0 })
    rewardFindUnique.mockResolvedValue(null)
    await expect(updateReward('r1', rewardInputSchema.parse(formInput))).rejects.toThrow('no longer exists')
    rewardUpdateMany.mockResolvedValue({ count: 0 })
    await expect(setRewardActive('r1', false)).rejects.toBeInstanceOf(RewardAdminError)
  })

  it('refuses to delete a redeemed reward, because codes and history point at it', async () => {
    redemptionCount.mockResolvedValue(2)
    await expect(deleteReward('r1')).rejects.toThrow('Switch it off instead')
    expect(rewardDeleteMany).not.toHaveBeenCalled()
  })

  it('deletes an unredeemed reward, and survives a redemption racing the delete', async () => {
    redemptionCount.mockResolvedValue(0)
    rewardDeleteMany.mockResolvedValue({ count: 1 })
    await expect(deleteReward('r1')).resolves.toBeUndefined()

    rewardDeleteMany.mockRejectedValue(knownError('P2003'))
    await expect(deleteReward('r1')).rejects.toThrow('just redeemed')
  })
})
