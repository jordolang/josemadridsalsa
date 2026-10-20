import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const headerValues = new Map<string, string>()
const redirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`)
})
const getCurrentFundraiserAccount = vi.fn()
const getCurrentUser = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }) }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/rbac', () => ({ getCurrentFundraiserAccount, getCurrentUser }))
vi.mock('@/components/fundraiser-portal/portal-nav', () => ({ PortalNav: () => null }))

const { default: FundraiserPortalLayout } = await import('@/app/(fundraiser-portal)/fundraiser-portal/layout')

beforeEach(() => {
  headerValues.clear()
  redirect.mockClear()
  getCurrentUser.mockResolvedValue(null)
  getCurrentFundraiserAccount.mockResolvedValue({ status: 'PENDING', fundraiser: { name: 'Band', subdomain: 'band' } })
})

describe('fundraiser portal layout', () => {
  it('renders the pending page for a pending account instead of redirecting to it again', async () => {
    // proxy.ts sets x-pathname; reading anything else made this loop forever.
    headerValues.set('x-pathname', '/fundraiser-portal/pending')
    await expect(FundraiserPortalLayout({ children: 'pending' })).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('sends a pending account anywhere else in the portal to the pending page', async () => {
    headerValues.set('x-pathname', '/fundraiser-portal/orders')
    await expect(FundraiserPortalLayout({ children: null })).rejects.toThrow('redirect:/fundraiser-portal/pending')
  })

  it('sends someone signed out to sign-in, coming back to the page they asked for', async () => {
    getCurrentFundraiserAccount.mockResolvedValue(null)
    headerValues.set('x-pathname', '/fundraiser-portal/team')
    await expect(FundraiserPortalLayout({ children: null })).rejects.toThrow(
      'redirect:/auth/signin?callbackUrl=%2Ffundraiser-portal%2Fteam'
    )
  })

  it('tells a signed-in visitor with no fundraiser so, instead of sending them back to sign-in', async () => {
    // Sending them to sign-in again made a working sign-in look broken.
    getCurrentFundraiserAccount.mockResolvedValue(null)
    getCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' })
    headerValues.set('x-pathname', '/fundraiser-portal/dashboard')
    render(await FundraiserPortalLayout({ children: 'portal' }))
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'No fundraiser on this account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a fundraiser' })).toHaveAttribute('href', '/start')
    expect(screen.queryByText('portal')).not.toBeInTheDocument()
  })
})
