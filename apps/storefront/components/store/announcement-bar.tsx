import { getLiveAnnouncements } from '@/lib/cms/queries'
import { AnnouncementBarClient } from './announcement-bar-client'

/**
 * The site-wide announcement bar, managed from
 * /admin/content/announcements. Renders nothing when no announcement is
 * scheduled for the current path.
 *
 * Which announcement applies to the current path is decided in the client
 * component via `usePathname()`. This component used to read `x-pathname` from
 * `headers()` instead, and because it sits in the `(public)` layout that single
 * dynamic API opted every public route out of static rendering — which made the
 * per-page `revalidate` windows inert.
 */
export async function AnnouncementBar() {
  const announcements = await getLiveAnnouncements()

  if (announcements.length === 0) return null

  return <AnnouncementBarClient announcements={announcements} />
}
