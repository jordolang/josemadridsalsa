import { trackEvent } from '@/lib/analytics/amplitude'

/**
 * "Checkout started", sent to every tracker the site loads (Google Tag
 * Manager, the Meta and TikTok pixels, Amplitude) at the moment a shopper is
 * handed to BigCommerce's checkout. It is the last step this site can see:
 * the purchase itself happens on BigCommerce's domain and is recorded by the
 * trackers connected in BigCommerce's own settings.
 */

type TrackerWindow = Window & {
  dataLayer?: unknown[]
  fbq?: (...args: unknown[]) => void
  ttq?: { track: (event: string, properties?: Record<string, unknown>) => void }
}

export type CheckoutStartedLine = {
  slug: string
  name: string
  price: number
  quantity: number
}

export function trackCheckoutStarted(lines: CheckoutStartedLine[]): void {
  if (typeof window === 'undefined' || lines.length === 0) return
  const w = window as TrackerWindow

  const value = Math.round(lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100
  const numItems = lines.reduce((sum, line) => sum + line.quantity, 0)
  const contentIds = lines.map((line) => line.slug)

  // Each tracker is independent: one missing or throwing must not stop the others,
  // and none may stop the shopper reaching checkout.
  const safely = (send: () => void) => {
    try {
      send()
    } catch {
      // Tracking is best-effort.
    }
  }

  safely(() => {
    w.dataLayer = w.dataLayer ?? []
    // GA4 ecommerce: clear the previous ecommerce object before pushing a new one.
    w.dataLayer.push({ ecommerce: null })
    w.dataLayer.push({
      event: 'begin_checkout',
      ecommerce: {
        currency: 'USD',
        value,
        items: lines.map((line) => ({
          item_id: line.slug,
          item_name: line.name,
          price: line.price,
          quantity: line.quantity,
        })),
      },
    })
  })
  safely(() => w.fbq?.('track', 'InitiateCheckout', { value, currency: 'USD', num_items: numItems, content_ids: contentIds }))
  safely(() => w.ttq?.track('InitiateCheckout', { value, currency: 'USD', content_type: 'product', content_id: contentIds.join(',') }))
  safely(() => trackEvent('Checkout Started', { value, numItems, checkout: 'bigcommerce' }))
}
