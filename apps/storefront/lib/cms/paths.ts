/**
 * Path targeting for CMS content (announcements, banners).
 *
 * Kept out of `queries.ts` so client components can import it without pulling
 * Prisma into the browser bundle.
 */

/**
 * Whether a target-path list matches the current path.
 * An empty list means "everywhere"; otherwise entries are prefix-matched.
 */
export function matchesPath(targetPaths: string[], pathname: string): boolean {
  if (!targetPaths || targetPaths.length === 0) return true
  return targetPaths.some((target) => {
    const clean = target.trim()
    if (!clean) return false
    if (clean === '/') return pathname === '/'
    return pathname === clean || pathname.startsWith(`${clean}/`)
  })
}
