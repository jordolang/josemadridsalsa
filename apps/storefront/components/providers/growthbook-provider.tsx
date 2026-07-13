'use client'

import { GrowthBookProvider } from '@growthbook/growthbook-react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'

import {
  createGrowthBookInstance,
  readOrCreateAnonymousId,
} from '@/lib/growthbook'

interface GrowthBookAppProviderProps {
  children: React.ReactNode
}

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobi|Android/i.test(ua)) return 'mobile'
  return 'desktop'
}

/**
 * Mounts a single long-lived GrowthBook instance, boots SSE streaming, and
 * syncs identity attributes whenever the authenticated session changes.
 *
 * Must be rendered inside a next-auth `SessionProvider` so `useSession()`
 * resolves; typically wrapped once at the root of the app.
 */
export function GrowthBookAppProvider({ children }: GrowthBookAppProviderProps) {
  const growthbook = useMemo(() => createGrowthBookInstance(), [])
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const lastAttributesRef = useRef<string>('')

  useEffect(() => {
    void growthbook.init({ streaming: true })
    return () => {
      growthbook.destroy()
    }
  }, [growthbook])

  useEffect(() => {
    if (status === 'loading') return
    const anonId = readOrCreateAnonymousId()
    const userId = session?.user?.id ?? ''
    const role = session?.user?.role ?? 'anonymous'
    const attributes = {
      id: userId || anonId,
      anonId,
      userId,
      loggedIn: Boolean(userId),
      role,
      url: pathname ?? '',
      deviceType: detectDeviceType(),
    }
    const serialized = JSON.stringify(attributes)
    if (serialized === lastAttributesRef.current) return
    lastAttributesRef.current = serialized
    void growthbook.setAttributes(attributes)
  }, [growthbook, session?.user?.id, session?.user?.role, status, pathname])

  return <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider>
}
