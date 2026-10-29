import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))

vi.mock('@/lib/auth/sign-in-throttle', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/sign-in-throttle')>()),
  isSignInAllowed: vi.fn(),
  compareAgainstDummyHash: vi.fn(async () => false),
}))

import { authOptions } from '@/lib/auth'
import { compareAgainstDummyHash, isSignInAllowed } from '@/lib/auth/sign-in-throttle'
import { prisma } from '@/lib/prisma'

type Authorize = (
  credentials: Record<string, string>,
  req: { headers: Record<string, string> }
) => Promise<unknown>

const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as unknown as {
  options: { authorize: Authorize }
}
const authorize = credentialsProvider.options.authorize

const req = { headers: { 'x-forwarded-for': '203.0.113.7' } }

describe('credentials authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('throttles by IP and email before looking up the account', async () => {
    vi.mocked(isSignInAllowed).mockResolvedValue(false)

    await expect(authorize({ email: 'A@Example.com ', password: 'pw' }, req)).rejects.toThrow(
      'SIGN_IN_THROTTLED'
    )
    expect(isSignInAllowed).toHaveBeenCalledWith({ email: 'a@example.com', ip: '203.0.113.7' })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  // Regression: an unknown email returned before bcrypt ran, so the quicker
  // response told an attacker the account did not exist.
  it('spends a bcrypt compare on an unknown email', async () => {
    vi.mocked(isSignInAllowed).mockResolvedValue(true)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    await expect(authorize({ email: 'nobody@example.com', password: 'pw' }, req)).resolves.toBeNull()
    expect(compareAgainstDummyHash).toHaveBeenCalledWith('pw')
  })

  it('spends a bcrypt compare on an account with no password', async () => {
    vi.mocked(isSignInAllowed).mockResolvedValue(true)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'oauth@example.com',
      name: null,
      role: 'CUSTOMER',
      password: null,
      twoFactorEnabledAt: null,
    } as never)

    await expect(authorize({ email: 'oauth@example.com', password: 'pw' }, req)).resolves.toBeNull()
    expect(compareAgainstDummyHash).toHaveBeenCalledWith('pw')
  })
})
