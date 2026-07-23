'use client'

import Script from 'next/script'

interface GoogleCustomerReviewsOptInProps {
  orderId: string
  email: string
  deliveryCountry: string
  // Formatted as YYYY-MM-DD, per Google Customer Reviews requirements.
  estimatedDeliveryDate: string
  gtins: string[]
}

// Merchant identifier issued by Google for the Jose Madrid Salsa Customer Reviews program.
const MERCHANT_ID = 731675578

declare global {
  interface Window {
    gapi?: {
      load: (feature: string, callback: () => void) => void
      surveyoptin?: {
        render: (config: Record<string, unknown>) => void
      }
    }
  }
}

// Renders the Google Customer Reviews opt-in survey on the order confirmation page.
// gapi.load + surveyoptin.render is invoked once platform.js has loaded (next/script's
// onLoad replaces the snippet's `?onload=renderOptIn` global callback).
export function GoogleCustomerReviewsOptIn({
  orderId,
  email,
  deliveryCountry,
  estimatedDeliveryDate,
  gtins,
}: GoogleCustomerReviewsOptInProps) {
  return (
    <Script
      id="google-customer-reviews-optin"
      src="https://apis.google.com/js/platform.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.gapi?.load('surveyoptin', () => {
          window.gapi?.surveyoptin?.render({
            merchant_id: MERCHANT_ID,
            order_id: orderId,
            email,
            delivery_country: deliveryCountry,
            estimated_delivery_date: estimatedDeliveryDate,
            ...(gtins.length > 0
              ? { products: gtins.map((gtin) => ({ gtin })) }
              : {}),
          })
        })
      }}
    />
  )
}
