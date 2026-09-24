import { revalidatePath } from 'next/cache'

/**
 * Purge the cached renders of a Heat Index article so the next request sees the
 * version just saved.
 *
 * The article page is ISR-cached (`revalidate = 900`) and the listings for 300
 * seconds, and nothing else in the save path invalidates them, so an article
 * published or re-covered now was still served from an older render for up to
 * fifteen minutes. That is mostly a cosmetic lag for a human reader, but not for
 * a social crawler: Facebook scrapes the article the moment it is cross-posted
 * and keeps whatever `og:image` that render carried for weeks, which freezes a
 * stale share image onto the post permanently.
 *
 * Call this after the write and before any cross-post, so the crawler renders
 * the current cover image rather than the one the cache still holds.
 */
export function revalidateBlogPost(slug: string): void {
  revalidatePath(`/heat-index/${slug}`)
  revalidatePath('/heat-index')
  revalidatePath('/sitemap.xml')
}
