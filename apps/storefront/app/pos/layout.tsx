import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { POSNav } from './pos-nav'

export const metadata: Metadata = {
  title: 'POS - Jose Madrid Salsa',
  description: 'Point of Sale terminal for Jose Madrid Salsa',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// The register's APIs already require orders:write; check it here too so a signed-out or
// customer visitor gets the sign-in page rather than a till whose every button fails.
export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/pos')
  if (!(await hasPermission(user, 'orders:write'))) redirect('/')

  return (
    <div className="flex h-dvh flex-col bg-slate-100 overflow-hidden">
      <POSNav />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
