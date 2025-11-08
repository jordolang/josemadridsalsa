++ app/gift-certificates/layout.tsx
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Gift Certificates - Jose Madrid Salsa',
  description:
    'Give the gift of authentic Jose Madrid Salsa. Purchase, check balances, or redeem digital gift certificates for any of our gourmet salsa flavors.',
  pathname: '/gift-certificates',
})

export default function GiftCertificatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

