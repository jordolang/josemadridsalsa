'use client'

import { PayPalButtons, FUNDING } from '@paypal/react-paypal-js'

interface CartItem {
  id: string
  quantity: number
}

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

interface PayPalButtonProps {
  items: CartItem[]
  customer: CustomerInfo
  shipping: ShippingInfo
  notes?: string
  shippingMethod?: string
  referralCode?: string
  onSuccess: (orderId: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

export function PayPalButton({ items, customer, shipping, notes, shippingMethod, referralCode, onSuccess, onError, disabled }: PayPalButtonProps) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <PayPalButtons
        fundingSource={FUNDING.PAYPAL}
        style={{
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 48,
        }}
        createOrder={async () => {
          try {
            const response = await fetch('/api/checkout/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: items.map((item) => ({
                  productId: item.id,
                  quantity: item.quantity,
                })),
                customer,
                shipping,
                notes,
                shippingMethod,
                referralCode,
              }),
            })

            if (!response.ok) {
              const data = await response.json()
              throw new Error(data.error || 'Failed to create PayPal order')
            }

            const data = await response.json()
            return data.paypalOrderId
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to create PayPal order'
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
            onSuccess(result.orderId)
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Payment capture failed'
            onError(message)
          }
        }}
        onError={(err) => {
          onError('PayPal encountered an error. Please try again.')
        }}
        onCancel={() => {
          // User closed PayPal popup — no action needed
        }}
      />
    </div>
  )
}
