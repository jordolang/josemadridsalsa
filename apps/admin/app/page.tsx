import { redirect } from 'next/navigation'

// The admin console lives in the storefront app; this workspace has no pages of its own.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.josemadrid.net').replace(/\/+$/, '')

export default function AdminHome() {
  redirect(`${SITE_URL}/admin`)
}
