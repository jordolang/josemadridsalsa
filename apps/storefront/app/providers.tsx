'use client'

import { SessionProvider } from 'next-auth/react'

import { GrowthBookAppProvider } from '@/components/providers/growthbook-provider'
import { ThemeProvider } from '@/components/ui/theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <GrowthBookAppProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </GrowthBookAppProvider>
    </SessionProvider>
  )
}
