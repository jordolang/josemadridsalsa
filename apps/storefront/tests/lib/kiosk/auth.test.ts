import { afterEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn()
vi.mock('@/lib/rbac', () => ({ requirePermission: (...args: unknown[]) => requirePermission(...args) }))

import { KioskAuthError, isValidKioskToken, requireKioskAccess } from '@/lib/kiosk/auth'

const TOKEN = 'k1-0123456789abcdef0123456789'
const req = (auth?: string) => new Request('https://x.test/api/kiosk/checkout', { headers: auth ? { authorization: auth } : {} })

afterEach(() => {
  vi.unstubAllEnvs()
  requirePermission.mockReset()
})

describe('kiosk auth', () => {
  it('accepts any configured device token', () => {
    vi.stubEnv('KIOSK_DEVICE_TOKENS', `other-token-aaaaaaaaaaaaaaaaaa, ${TOKEN}`)
    expect(isValidKioskToken(TOKEN)).toBe(true)
    expect(isValidKioskToken(TOKEN + 'x')).toBe(false)
    expect(isValidKioskToken('')).toBe(false)
  })

  it('ignores tokens too short to be safe', () => {
    vi.stubEnv('KIOSK_DEVICE_TOKENS', 'short')
    expect(isValidKioskToken('short')).toBe(false)
  })

  it('lets a paired tablet in without a staff session', async () => {
    vi.stubEnv('KIOSK_DEVICE_TOKENS', TOKEN)
    await expect(requireKioskAccess(req(`Bearer ${TOKEN}`))).resolves.toBe('device')
    expect(requirePermission).not.toHaveBeenCalled()
  })

  it('rejects a wrong token even for staff', async () => {
    vi.stubEnv('KIOSK_DEVICE_TOKENS', TOKEN)
    requirePermission.mockResolvedValue({ id: 'staff' })
    await expect(requireKioskAccess(req('Bearer nope'))).rejects.toBeInstanceOf(KioskAuthError)
  })

  it('falls back to a staff session in a browser', async () => {
    requirePermission.mockResolvedValue({ id: 'staff' })
    await expect(requireKioskAccess(req())).resolves.toBe('staff')
    // orders:write is the seeded permission; 'orders:create' never existed, so checking it locked every staff member out.
    expect(requirePermission).toHaveBeenCalledWith('orders:write')
    requirePermission.mockRejectedValue(new Error('Unauthorized'))
    await expect(requireKioskAccess(req())).rejects.toBeInstanceOf(KioskAuthError)
  })
})
