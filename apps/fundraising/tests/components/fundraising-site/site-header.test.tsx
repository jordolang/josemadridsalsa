import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FundraisingSiteHeader } from '@/components/fundraising-site/site-header'

const useSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth/react', () => ({ useSession }))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('FundraisingSiteHeader', () => {
  beforeEach(() => useSession.mockReset())

  it('links signed-out visitors to sign in, landing in the fundraiser portal', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(<FundraisingSiteHeader />)
    expect(screen.getByRole('link', { name: 'Fundraiser Login' })).toHaveAttribute(
      'href',
      '/auth/signin?callbackUrl=%2Ffundraiser-portal%2Fdashboard',
    )
  })

  it('sends a signed-in shopper with no fundraiser to sign in, not into the portal', () => {
    useSession.mockReturnValue({ data: { user: { id: 'u-1' } }, status: 'authenticated' })
    render(<FundraisingSiteHeader />)
    expect(screen.getByRole('link', { name: 'Fundraiser Login' })).toHaveAttribute(
      'href',
      '/auth/signin?callbackUrl=%2Ffundraiser-portal%2Fdashboard',
    )
  })

  it('links signed-in fundraisers straight to their portal', () => {
    useSession.mockReturnValue({ data: { user: { id: 'u-1', fundraiserId: 'f-1' } }, status: 'authenticated' })
    render(<FundraisingSiteHeader />)
    expect(screen.getByRole('link', { name: 'My Fundraiser' })).toHaveAttribute('href', '/fundraiser-portal/dashboard')
  })
})
