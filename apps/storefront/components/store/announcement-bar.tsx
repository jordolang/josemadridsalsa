import { headers } from 'next/headers'
import Link from 'next/link'
import { getActiveAnnouncement } from '@/lib/cms/queries'
import { AnnouncementBarClient } from './announcement-bar-client'

const VARIANT_CLASSES: Record<string, string> = {
  INFO: 'bg-primary text-primary-foreground',
  PROMO: 'bg-amber-500 text-black',
  WARNING: 'bg-destructive text-destructive-foreground',
  SUCCESS: 'bg-emerald-600 text-white',
}

/**
 * The site-wide announcement bar, managed from
 * /admin/content/announcements. Renders nothing when no announcement is
 * scheduled for the current path.
 */
export async function AnnouncementBar() {
  const headerList = await headers()
  const pathname = headerList.get('x-pathname') ?? '/'
  const announcement = await getActiveAnnouncement(pathname)

  if (!announcement) return null

  const classes = VARIANT_CLASSES[announcement.variant] ?? VARIANT_CLASSES.INFO

  const content = (
    <div className="flex items-center justify-center gap-3 px-4 py-2 text-center text-sm font-medium">
      <span>{announcement.message}</span>
      {announcement.ctaText && announcement.ctaHref && (
        <Link href={announcement.ctaHref} className="underline underline-offset-4">
          {announcement.ctaText}
        </Link>
      )}
    </div>
  )

  if (!announcement.dismissible) {
    return (
      <div role="status" className={`w-full ${classes}`}>
        {content}
      </div>
    )
  }

  return (
    <AnnouncementBarClient id={announcement.id} className={`w-full ${classes}`}>
      {content}
    </AnnouncementBarClient>
  )
}
