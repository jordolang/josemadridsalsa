'use client'

import { CashAppPay } from 'react-square-web-payments-sdk'
import { SquareProvider, SQUARE_APP_ID, SQUARE_LOCATION_ID } from './SquareProvider'
import { toCheckoutSelections, type CartItem } from '@/lib/store/cart'

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

interface CashAppButtonProps {
  items: CartItem[]
  customer: CustomerInfo
  shipping: ShippingInfo
  total: number
  notes?: string
  shippingMethod?: string
  referralCode?: string
  onSuccess: (orderId: string, orderAccessToken: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

export function CashAppButton({ items, customer, shipping, total, notes, shippingMethod, referralCode, onSuccess, onError, disabled }: CashAppButtonProps) {
  if (!SQUARE_APP_ID || !SQUARE_LOCATION_ID) {
    return null
  }

  const handleTokenize = async (token: string) => {
    try {
      // Step 1: Create the order in the database
      const createResponse = await fetch('/api/checkout/square/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...toCheckoutSelections(items),
          customer,
          shipping,
          notes,
          shippingMethod,
          referralCode,
        }),
      })

      if (!createResponse.ok) {
        const data = await createResponse.json()
        throw new Error(data.error || 'Failed to create order')
      }

      const { orderId } = await createResponse.json()

      // Step 2: Process payment with the Cash App token
      const paymentResponse = await fetch('/api/checkout/square/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: token,
          orderId,
        }),
      })

      if (!paymentResponse.ok) {
        const data = await paymentResponse.json()
        throw new Error(data.error || 'Failed to process Cash App payment')
      }

      const result = await paymentResponse.json()
      onSuccess(result.orderId, result.orderAccessToken)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cash App payment failed'
      onError(message)
    }
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <SquareProvider total={total} onTokenize={handleTokenize} onError={onError}>
        <CashAppPay redirectURL={typeof window !== 'undefined' ? window.location.href : ''} referenceId={`jms-${Date.now()}`} />
      </SquareProvider>
    </div>
  )
}
