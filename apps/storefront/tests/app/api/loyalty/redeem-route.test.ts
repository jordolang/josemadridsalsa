import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getCurrentUser = vi.fn()
const redeemReward = vi.fn()
const revalidatePath = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/rbac', () => ({ getCurrentUser }))
vi.mock('@/lib/loyalty', () => ({ redeemReward }))

const { POST } = await import('@/app/api/loyalty/redeem/route')

const REWARD_ID = 'ckreward000000000000000001'

function redeemRequest(body: unknown) {
  return new NextRequest('http://localhost/api/loyalty/redeem', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/loyalty/redeem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue({ id: 'user-1' })
  })

  it('refreshes the public rewards catalog after a successful redemption', async () => {
    redeemReward.mockResolvedValue({ success: true, redemption: { id: 'redemption-1' } })

    const res = await POST(redeemRequest({ rewardId: REWARD_ID }))

    expect(res.status).toBe(200)
    expect(redeemReward).toHaveBeenCalledWith('user-1', REWARD_ID)
    expect(revalidatePath).toHaveBeenCalledWith('/rewards')
  })

  it('leaves the catalog alone when the redemption fails', async () => {
    redeemReward.mockResolvedValue({ success: false, error: 'Reward is no longer available' })

    const res = await POST(redeemRequest({ rewardId: REWARD_ID }))

    expect(res.status).toBe(400)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects signed-out requests', async () => {
    getCurrentUser.mockResolvedValue(null)

    const res = await POST(redeemRequest({ rewardId: REWARD_ID }))

    expect(res.status).toBe(401)
    expect(redeemReward).not.toHaveBeenCalled()
  })
})
