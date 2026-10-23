/** How stale `User.lastLoginAt` may get while someone keeps using the site. */
export const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000

/**
 * When each user was last written by this server instance. Server Components
 * can't rewrite the session cookie, so a token's own timestamp may never
 * advance there; this stops those renders re-checking the database every time.
 */
const recordedAt = new Map<string, number>()

/** Whether a session last stamped at `lastSeenAt` is due another write. */
export function isLastSeenStale(lastSeenAt: number | undefined, now: number): boolean {
  return typeof lastSeenAt !== 'number' || now - lastSeenAt >= LAST_SEEN_INTERVAL_MS
}

/**
 * Stamp `User.lastLoginAt` — the admin Users page's "Last Logged In" — for a
 * sign-in or for site activity. A sign-in always writes. Activity writes at
 * most once an hour per user: the update only matches when the stored value is
 * older than that, so every instance and every unpersisted token agrees.
 *
 * Never throws: a failed stamp must not sign anyone out.
 */
export async function recordLastSeen(
  userId: string,
  { signIn = false, now = new Date() }: { signIn?: boolean; now?: Date } = {}
): Promise<void> {
  const nowMs = now.getTime()
  if (!signIn && !isLastSeenStale(recordedAt.get(userId), nowMs)) return
  recordedAt.set(userId, nowMs)

  try {
    // Loaded lazily, like the rest of auth, so a database problem can't break module load.
    const { prisma } = await import('@/lib/prisma')
    await prisma.user.updateMany({
      where: signIn
        ? { id: userId }
        : {
            id: userId,
            OR: [
              { lastLoginAt: null },
              { lastLoginAt: { lt: new Date(nowMs - LAST_SEEN_INTERVAL_MS) } },
            ],
          },
      data: { lastLoginAt: now },
    })
  } catch (error) {
    recordedAt.delete(userId)
    console.error('[Auth] Failed to record last login:', error)
  }
}

/** Test hook: forget which users this instance has stamped. */
export function resetLastSeenCache(): void {
  recordedAt.clear()
}
