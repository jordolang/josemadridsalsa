import { describe, it, expect, vi, beforeEach } from 'vitest'

const headerValues = new Map<string, string>()
const redirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`)
})
const getCurrentFundraiserAccount = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }) }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/rbac', () => ({ getCurrentFundraiserAccount }))
vi.mock('@/components/fundraiser-portal/portal-nav', () => ({ PortalNav: () => null }))

const { default: FundraiserPortalLayout } = await import('@/app/(fundraiser-portal)/fundraiser-portal/layout')

beforeEach(() => {
  headerValues.clear()
  redirect.mockClear()
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

  it('sends someone signed out to sign-in', async () => {
    getCurrentFundraiserAccount.mockResolvedValue(null)
    await expect(FundraiserPortalLayout({ children: null })).rejects.toThrow('redirect:/auth/signin')
  })
})
