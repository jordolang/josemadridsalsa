import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const refresh = vi.fn()
const toastError = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

const { RedeemRewardButton } = await import('@/app/(public)/account/rewards/redeem-reward-button')

describe('RedeemRewardButton', () => {
  it('refreshes the account when the response is lost, so a committed code shows before any retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    render(<RedeemRewardButton rewardId="r1" disabledReason={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Connection lost/))
    expect(screen.getByRole('button', { name: 'Redeem' })).not.toBeDisabled()
    vi.unstubAllGlobals()
  })
})
