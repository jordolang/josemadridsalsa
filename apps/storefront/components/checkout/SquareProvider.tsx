'use client'

import { PaymentForm } from 'react-square-web-payments-sdk'

interface SquareProviderProps {
  children: React.ReactNode
  total: number
  onTokenize: (token: string) => void
  onError: (message: string) => void
}

const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID || ''
const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || ''

export { appId as SQUARE_APP_ID, locationId as SQUARE_LOCATION_ID }

export function SquareProvider({
  children,
  total,
  onTokenize,
  onError,
}: SquareProviderProps) {
  if (!appId || !locationId) {
    return <>{children}</>
  }

  return (
    <PaymentForm
      applicationId={appId}
      locationId={locationId}
      cardTokenizeResponseReceived={(tokenResult) => {
        if (tokenResult.status === 'OK' && tokenResult.token) {
          onTokenize(tokenResult.token)
        } else {
          const errors = (tokenResult as any).errors
          const errorMsg =
            errors?.[0]?.message ||
            'Payment tokenization failed. Please try again.'
          onError(errorMsg)
        }
      }}
      createPaymentRequest={() => ({
        countryCode: 'US',
        currencyCode: 'USD',
        total: {
          amount: total.toFixed(2),
          label: 'Jose Madrid Salsa',
        },
      })}
    >
      {children}
    </PaymentForm>
  )
}
