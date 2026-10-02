import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
const hasPermission = vi.fn()
const logAudit = vi.fn()
const createReward = vi.fn()
const updateReward = vi.fn()
const deleteReward = vi.fn()
const setRewardActive = vi.fn()

class RewardAdminError extends Error {}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rbac', () => ({ getCurrentUser, hasPermission }))
vi.mock('@/lib/audit', () => ({ logAudit }))
vi.mock('@/lib/loyalty-rewards', () => ({
  RewardAdminError,
  createReward,
  updateReward,
  deleteReward,
  setRewardActive,
}))

const { saveRewardAction, deleteRewardAction } = await import('@/app/admin/settings/loyalty-rewards/actions')

function rewardForm(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  const values = {
    name: '$5 Off',
    description: 'Get $5 off',
    pointsCost: '500',
    rewardValue: '5',
    minimumTier: 'BRONZE',
    maxRedemptions: '',
    isActive: 'true',
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) fd.set(key, value)
  return fd
}

describe('loyalty reward admin actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    hasPermission.mockResolvedValue(true)
    createReward.mockResolvedValue({ id: 'r1', name: '$5 Off' })
    updateReward.mockResolvedValue({ id: 'r1', name: '$5 Off' })
  })

  it('requires settings:write', async () => {
    hasPermission.mockResolvedValue(false)
    expect(await saveRewardAction(null, rewardForm())).toEqual({ error: 'Unauthorized' })
    expect(hasPermission).toHaveBeenCalledWith({ id: 'admin-1' }, 'settings:write')
    expect(createReward).not.toHaveBeenCalled()
  })

  it('creates or updates depending on the id, and audits it', async () => {
    expect(await saveRewardAction(null, rewardForm())).toEqual({ success: true })
    expect(createReward).toHaveBeenCalled()
    expect(await saveRewardAction('r1', rewardForm())).toEqual({ success: true })
    expect(updateReward.mock.calls[0][0]).toBe('r1')
    expect(logAudit).toHaveBeenCalledTimes(2)
  })

  it('returns the first validation message instead of saving', async () => {
    expect(await saveRewardAction(null, rewardForm({ pointsCost: '0' }))).toEqual({
      error: 'Points cost must be at least 1',
    })
    expect(createReward).not.toHaveBeenCalled()
  })

  it('surfaces a business-rule refusal as the error', async () => {
    deleteReward.mockRejectedValue(new RewardAdminError('Switch it off instead of deleting it.'))
    expect(await deleteRewardAction('r1')).toEqual({ error: 'Switch it off instead of deleting it.' })
    expect(logAudit).not.toHaveBeenCalled()
  })
})
