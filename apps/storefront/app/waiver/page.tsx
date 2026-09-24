import type { Metadata, Viewport } from 'next'
import { PromoReleaseKiosk } from '@/components/waiver/PromoReleaseKiosk'
import { requireAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Photo & Video Release',
  description: 'In-person photo and video release for Jose Madrid Salsa events.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#fffbeb',
}

/**
 * iPad kiosk: a staff member signs in once, opens /waiver (optionally
 * /waiver?event=Zanesville%20Farmers%20Market), and hands the tablet over.
 */
export default async function WaiverPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>
}) {
  await requireAdminSession()
  const { event } = await searchParams
  const eventName = (Array.isArray(event) ? event[0] : event)?.trim().slice(0, 80) || undefined

  return <PromoReleaseKiosk event={eventName} />
}
