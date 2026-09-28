import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { FundraisingSiteHeader } from '@/components/fundraising-site/site-header'
import { FundraisingSiteFooter } from '@/components/fundraising-site/site-footer'
import { getFundraisingSiteUrl } from '@/lib/fundraising-site/host'

/**
 * Shell for fundraising.josemadrid.net. The proxy rewrites that host into this
 * folder, so every link in here is host-relative ("/shop", not
 * "/fundraising-site/shop").
 */
export const metadata: Metadata = {
  metadataBase: new URL(getFundraisingSiteUrl()),
  title: {
    default: 'Jose Madrid Salsa Fundraising',
    template: '%s | Jose Madrid Salsa Fundraising',
  },
  description:
    'Raise money for your school, team or club with Jose Madrid Salsa: $10 jars, $5 back to your group on every one, shipped straight to your supporters.',
  openGraph: { siteName: 'Jose Madrid Salsa Fundraising', type: 'website' },
}

export default function FundraisingSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <FundraisingSiteHeader />
      <main className="flex-1">{children}</main>
      <FundraisingSiteFooter />
      <Toaster />
    </div>
  )
}
