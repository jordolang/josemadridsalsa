++ app/products/layout.tsx
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Products - Jose Madrid Salsa',
  description: 'Browse the full Jose Madrid Salsa catalog of gourmet salsas and bundles.',
  pathname: '/products',
})

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

