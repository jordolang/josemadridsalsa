import type { Metadata, Viewport } from 'next'
import { Alfa_Slab_One } from 'next/font/google'
import './kiosk.css'

const alfaSlab = Alfa_Slab_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-alfa-slab',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Self-Order Kiosk',
  description: 'Jose Madrid Salsa self-order kiosk',
  // A till, not a page: keep it out of search results.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0B0605',
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${alfaSlab.variable} kiosk-root fixed inset-0 overflow-hidden bg-[#0B0605]`}>{children}</div>
}
