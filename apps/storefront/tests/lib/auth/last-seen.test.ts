import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { updateMany: vi.fn() } },
}))

import {
  LAST_SEEN_INTERVAL_MS,
  isLastSeenStale,
  recordLastSeen,
  resetLastSeenCache,
} from '@/lib/auth/last-seen'
import { prisma } from '@/lib/prisma'

const now = new Date('2026-10-23T16:00:00Z')

describe('isLastSeenStale', () => {
  it('is stale when the session was never stamped', () => {
    expect(isLastSeenStale(undefined, now.getTime())).toBe(true)
  })

  it('waits an hour between stamps', () => {
    expect(isLastSeenStale(now.getTime() - LAST_SEEN_INTERVAL_MS + 1, now.getTime())).toBe(false)
    expect(isLastSeenStale(now.getTime() - LAST_SEEN_INTERVAL_MS, now.getTime())).toBe(true)
  })
})

describe('recordLastSeen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLastSeenCache()
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never)
  })

  it('always stamps a sign-in', async () => {
    await recordLastSeen('user-1', { signIn: true, now })
    await recordLastSeen('user-1', { signIn: true, now })

    expect(prisma.user.updateMany).toHaveBeenCalledTimes(2)
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastLoginAt: now },
    })
  })

  it('stamps activity only over a value older than an hour', async () => {
    await recordLastSeen('user-1', { now })

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        OR: [
          { lastLoginAt: null },
          { lastLoginAt: { lt: new Date(now.getTime() - LAST_SEEN_INTERVAL_MS) } },
        ],
      },
      data: { lastLoginAt: now },
    })
  })

  it('skips the database for activity within the hour on the same instance', async () => {
    await recordLastSeen('user-1', { now })
    await recordLastSeen('user-1', { now: new Date(now.getTime() + 30 * 60 * 1000) })
    await recordLastSeen('user-1', { now: new Date(now.getTime() + LAST_SEEN_INTERVAL_MS) })

    expect(prisma.user.updateMany).toHaveBeenCalledTimes(2)
  })

  it('never throws, and retries after a failed write', async () => {
    vi.mocked(prisma.user.updateMany).mockRejectedValueOnce(new Error('db down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(recordLastSeen('user-1', { now })).resolves.toBeUndefined()
    await recordLastSeen('user-1', { now })

    expect(prisma.user.updateMany).toHaveBeenCalledTimes(2)
    error.mockRestore()
  })
})
