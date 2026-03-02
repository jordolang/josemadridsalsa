'use client'

import * as React from 'react'
import Script from 'next/script'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID

/**
 * Google Analytics 4 integration component
 *
 * This component loads Google Analytics scripts and respects user consent preferences.
 * It should be placed in the root layout and will only initialize GA4 when:
 * 1. A valid measurement ID is configured
 * 2. User has accepted cookies (when used with consent system)
 *
 * @example
 * ```tsx
 * import { GoogleAnalytics } from '@/lib/analytics/google-analytics'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <GoogleAnalytics />
 *         {children}
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function GoogleAnalytics() {
  const [isEnabled, setIsEnabled] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)

    // Only enable GA4 if measurement ID is configured
    if (!GA_MEASUREMENT_ID) {
      return
    }

    // Check cookie consent from localStorage
    if (typeof window !== 'undefined') {
      try {
        const consent = window.localStorage.getItem('cookie-consent')
        if (consent === 'accepted') {
          setIsEnabled(true)
        }

        // Listen for consent changes
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'cookie-consent') {
            setIsEnabled(e.newValue === 'accepted')
          }
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
      } catch (error) {
        console.error('Failed to check cookie consent for Google Analytics:', error)
      }
    }
  }, [])

  // Don't render scripts until mounted (prevents SSR issues)
  if (!isMounted || !isEnabled || !GA_MEASUREMENT_ID) {
    return null
  }

  return (
    <>
      {/* Global Site Tag (gtag.js) - Google Analytics */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  )
}

/**
 * Track a custom event in Google Analytics
 *
 * @param eventName - The name of the event to track
 * @param eventParams - Optional parameters to include with the event
 *
 * @example
 * ```tsx
 * trackEvent('add_to_cart', {
 *   item_id: 'SALSA-001',
 *   item_name: 'Mild Salsa',
 *   price: 8.99,
 * })
 * ```
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, any>
): void {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) {
    return
  }

  try {
    const consent = window.localStorage.getItem('cookie-consent')
    if (consent !== 'accepted') {
      return
    }

    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', eventName, eventParams)
    }
  } catch (error) {
    console.error('Failed to track Google Analytics event:', error)
  }
}

/**
 * Track a page view in Google Analytics
 * Useful for tracking page views in single-page applications
 *
 * @param url - The URL to track (defaults to current pathname)
 *
 * @example
 * ```tsx
 * trackPageView('/products/mild-salsa')
 * ```
 */
export function trackPageView(url?: string): void {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) {
    return
  }

  try {
    const consent = window.localStorage.getItem('cookie-consent')
    if (consent !== 'accepted') {
      return
    }

    if (typeof window.gtag !== 'undefined') {
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_path: url || window.location.pathname,
      })
    }
  } catch (error) {
    console.error('Failed to track Google Analytics page view:', error)
  }
}

/**
 * Check if Google Analytics is currently enabled
 * Based on both measurement ID configuration and user consent
 *
 * @returns true if GA4 is enabled, false otherwise
 */
export function isGoogleAnalyticsEnabled(): boolean {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') {
    return false
  }

  try {
    const consent = window.localStorage.getItem('cookie-consent')
    return consent === 'accepted'
  } catch (error) {
    return false
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void
    dataLayer?: any[]
  }
}
