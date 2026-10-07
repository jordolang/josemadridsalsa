import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { BattleLiveNavLink, BattleLiveNavMobileLink } = await import('@/components/store/battle-live-nav-link')

function stubCount(playing: number) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ playing }) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BattleLiveNavLink', () => {
  it('links to the game and blinks green while someone is playing', async () => {
    const fetchMock = stubCount(3)
    render(<BattleLiveNavLink isHome={false} />)

    const link = screen.getByRole('link')
    expect(link).toHaveTextContent('Battle Live')
    expect(link).toHaveAttribute('href', 'https://battle.josemadridsalsa.com')
    expect(fetchMock).toHaveBeenCalledWith('/api/arena/live')
    await waitFor(() => expect(screen.getByTestId('battle-dot-live')).toBeInTheDocument())
    expect(link).toHaveAccessibleName(/3 players are in the Battle Arena now/)
  })

  it('shows a still, dim dot when nobody is playing', async () => {
    const fetchMock = stubCount(0)
    render(<BattleLiveNavLink isHome />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByTestId('battle-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('battle-dot-live')).not.toBeInTheDocument()
  })
})

describe('BattleLiveNavMobileLink', () => {
  it('shows how many are playing', async () => {
    stubCount(1)
    render(<BattleLiveNavMobileLink />)
    await waitFor(() => expect(screen.getByText('1 playing')).toBeInTheDocument())
    expect(screen.getByRole('link')).toHaveTextContent('Battle Live')
  })
})
