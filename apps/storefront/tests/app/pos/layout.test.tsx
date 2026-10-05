import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
const hasPermission = vi.fn()
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('@/lib/rbac', () => ({ getCurrentUser, hasPermission }))
vi.mock('next/navigation', () => ({ redirect, usePathname: () => '/pos' }))

const { default: POSLayout } = await import('@/app/pos/layout')

describe('POS layout access', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a signed-out visitor to sign in and back to the register', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(POSLayout({ children: null })).rejects.toThrow('REDIRECT:/auth/signin?callbackUrl=/pos')
  })

  it('turns away a signed-in user without orders:write', async () => {
    getCurrentUser.mockResolvedValue({ id: 'c1', role: 'CUSTOMER' })
    hasPermission.mockResolvedValue(false)
    await expect(POSLayout({ children: null })).rejects.toThrow('REDIRECT:/')
    expect(hasPermission).toHaveBeenCalledWith({ id: 'c1', role: 'CUSTOMER' }, 'orders:write')
  })

  it('renders the register for staff', async () => {
    getCurrentUser.mockResolvedValue({ id: 's1', role: 'STAFF' })
    hasPermission.mockResolvedValue(true)
    await expect(POSLayout({ children: null })).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
