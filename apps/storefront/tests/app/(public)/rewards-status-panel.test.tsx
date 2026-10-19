import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }))

const { RewardsStatusPanel } = await import('@/app/(public)/rewards/rewards-status-panel')

describe('RewardsStatusPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the balance and progress to the next tier', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pointsBalance: 640, lifetimePoints: 740, tier: 'SILVER' } }),
    }))
    render(<RewardsStatusPanel />)

    expect(await screen.findByText('640')).toBeInTheDocument()
    expect(screen.getByText('260 more points to Gold')).toBeInTheDocument()
  })

  it('links to the account page instead of loading forever when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    render(<RewardsStatusPanel />)

    expect(await screen.findByRole('link', { name: 'View your rewards' })).toHaveAttribute('href', '/account/rewards')
  })
})
