'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const COOKIE_CONSENT_KEY = 'cookie-consent'

type ConsentValue = 'accepted' | 'rejected' | null

interface CookieConsentBannerProps {
  onConsentChange?: (consent: ConsentValue) => void
}

export function CookieConsentBanner({ onConsentChange }: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)
  const pathname = usePathname()

  React.useEffect(() => {
    setIsMounted(true)

    // Check if user has already made a choice
    if (typeof window !== 'undefined') {
      try {
        const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY)
        if (!consent) {
          // Show banner only if no consent preference exists
          setIsVisible(true)
        } else {
          // Notify parent of existing consent
          onConsentChange?.(consent as ConsentValue)
        }
      } catch (error) {
        // If localStorage is not available, don't show banner
        console.error('Failed to read cookie consent from localStorage:', error)
      }
    }
  }, [onConsentChange])

  const handleAccept = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
        window.dispatchEvent(new CustomEvent('cookie-consent-change', { detail: 'accepted' }))
        setIsVisible(false)
        onConsentChange?.('accepted')
      } catch (error) {
        console.error('Failed to save cookie consent:', error)
      }
    }
  }, [onConsentChange])

  const handleReject = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected')
        window.dispatchEvent(new CustomEvent('cookie-consent-change', { detail: 'rejected' }))
        setIsVisible(false)
        onConsentChange?.('rejected')
      } catch (error) {
        console.error('Failed to save cookie consent:', error)
      }
    }
  }, [onConsentChange])

  const handleClose = React.useCallback(() => {
    setIsVisible(false)
  }, [])

  // Don't render anything until mounted (prevents SSR mismatch)
  // The self-order kiosk is a shop till, not a browsing session; a banner there just blocks customers.
  if (!isMounted || !isVisible || pathname?.startsWith('/kiosk')) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'animate-in slide-in-from-bottom duration-500'
      )}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent banner"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 text-sm">
            <p className="text-foreground">
              We use cookies to enhance your browsing experience and analyze our traffic. By clicking "Accept", you consent to our use of cookies.{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-primary"
              >
                Learn more
              </Link>
            </p>
          </div>
          <div className="flex gap-2 sm:flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              className="flex-1 sm:flex-initial"
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              className="flex-1 sm:flex-initial"
            >
              Accept
            </Button>
          </div>
        </div>
        <button
          onClick={handleClose}
          className={cn(
            'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:pointer-events-none'
          )}
          aria-label="Close cookie banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Hook to check if user has given cookie consent
 * @returns The current consent value or null if not set
 */
export function useCookieConsent(): ConsentValue {
  const [consent, setConsent] = React.useState<ConsentValue>(null)

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedConsent = window.localStorage.getItem(COOKIE_CONSENT_KEY)
        setConsent((storedConsent as ConsentValue) || null)
      } catch (error) {
        console.error('Failed to read cookie consent:', error)
      }
    }
  }, [])

  return consent
}

/**
 * Hook to check if analytics should be enabled based on consent
 * @returns true if analytics should be enabled, false otherwise
 */
export function useAnalyticsConsent(): boolean {
  const consent = useCookieConsent()
  return consent === 'accepted'
}
