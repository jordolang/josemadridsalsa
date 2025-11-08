++ app/auth/layout.tsx
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Account Access - Jose Madrid Salsa',
  description:
    'Sign in, sign up, or reset your Jose Madrid Salsa account credentials to manage orders and preferences.',
  pathname: '/auth',
})

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

