import type { Metadata, Viewport } from 'next'
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

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-slate-100 overflow-hidden">
      <POSNav />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
