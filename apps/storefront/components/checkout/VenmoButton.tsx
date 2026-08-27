'use client'

import { PayPalButtons, FUNDING } from '@paypal/react-paypal-js'
import { toCheckoutItems, type CartItem } from '@/lib/store/cart'

interface CustomerInfo {
  email: string
  firstName: string
  lastName: string
  phone?: string
}

interface ShippingInfo {
  address1: string
  address2?: string
  city: string
  state: string
  postalCode: string
}

interface VenmoButtonProps {
  items: CartItem[]
  customer: CustomerInfo
  shipping: ShippingInfo
  notes?: string
  shippingMethod?: string
  referralCode?: string
  onSuccess: (orderId: string, orderAccessToken: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

export function VenmoButton({ items, customer, shipping, notes, shippingMethod, referralCode, onSuccess, onError, disabled }: VenmoButtonProps) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <PayPalButtons
        fundingSource={FUNDING.VENMO}
        style={{
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'pay',
          height: 48,
        }}
        createOrder={async () => {
          try {
            const response = await fetch('/api/checkout/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: toCheckoutItems(items),
                customer,
                shipping,
                notes,
                shippingMethod,
                referralCode,
                fundingSource: 'venmo',
              }),
            })

            if (!response.ok) {
              const data = await response.json()
              throw new Error(data.error || 'Failed to create Venmo order')
            }

            const data = await response.json()
            return data.paypalOrderId
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to create Venmo order'
            onError(message)
            throw err
          }
        }}
        onApprove={async (data) => {
          try {
            const response = await fetch('/api/checkout/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paypalOrderId: data.orderID,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || 'Failed to capture payment')
            }

            const result = await response.json()
            onSuccess(result.orderId, result.orderAccessToken)
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Payment capture failed'
            onError(message)
          }
        }}
        onError={(err) => {
          onError('Venmo encountered an error. Please try again.')
        }}
        onCancel={() => {
          // User closed Venmo popup — no action needed
        }}
      />
    </div>
  )
}
