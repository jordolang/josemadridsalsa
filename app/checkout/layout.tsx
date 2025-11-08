++ app/checkout/layout.tsx
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Checkout - Jose Madrid Salsa',
  description: 'Securely review your cart, enter shipping details, and complete your Jose Madrid Salsa purchase.',
  pathname: '/checkout',
})

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

