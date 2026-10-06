'use client'

import { PayPalScriptProvider } from '@paypal/react-paypal-js'

interface PayPalProviderProps {
  children: React.ReactNode
}

const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''

export function PayPalProvider({ children }: PayPalProviderProps) {
  if (!clientId) {
    return <>{children}</>
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: 'USD',
        intent: 'capture',
        enableFunding: 'venmo',
      }}
    >
      {children}
    </PayPalScriptProvider>
  )
}
