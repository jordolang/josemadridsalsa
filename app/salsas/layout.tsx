++ app/salsas/layout.tsx
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Salsas - Jose Madrid Salsa',
  description:
    'Shop artisan Jose Madrid Salsa flavors from mild to fiery hot. Discover fruit salsas, habanero blends, and gift-ready packs.',
  pathname: '/salsas',
})

export default function SalsasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

