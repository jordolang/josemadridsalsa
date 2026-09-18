'use client'

import { useMemo } from 'react'
import { CreditCard, Wallet, Banknote, Smartphone, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type PaymentMethodId = 'card' | 'paypal' | 'venmo' | 'cashapp' | 'link'

interface PaymentMethod {
  id: PaymentMethodId
  label: string
  description?: string
  enabled: boolean
  icon?: string
}

interface PaymentMethodSelectorProps {
  methods: PaymentMethod[]
  selectedMethod: PaymentMethodId
  onSelect: (methodId: PaymentMethodId) => void
}

const ICON_MAP: Record<PaymentMethodId, LucideIcon> = {
  card: CreditCard,
  paypal: Wallet,
  venmo: Banknote,
  cashapp: Smartphone,
  link: Zap,
}

const hasStripeKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const hasPayPalClientId = !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
const hasSquareCredentials =
  !!process.env.NEXT_PUBLIC_SQUARE_APP_ID && !!process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID

const DEFAULT_METHODS: PaymentMethod[] = [
  {
    id: 'card',
    label: 'Credit / Debit Card',
    description: 'Visa, Mastercard, Amex',
    enabled: true,
  },
  {
    id: 'link',
    label: 'Link',
    description: 'One-click checkout by Stripe',
    enabled: hasStripeKey,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    enabled: hasPayPalClientId,
  },
  {
    id: 'venmo',
    label: 'Venmo',
    enabled: hasPayPalClientId,
  },
  {
    id: 'cashapp',
    label: 'Cash App Pay',
    enabled: hasSquareCredentials,
  },
]

export type { PaymentMethodId, PaymentMethod }
export { DEFAULT_METHODS }

export function PaymentMethodSelector({
  methods,
  selectedMethod,
  onSelect,
}: PaymentMethodSelectorProps) {
  const enabledMethods = useMemo(() => methods.filter((m) => m.enabled), [methods])
  const disabledMethods = useMemo(() => methods.filter((m) => !m.enabled), [methods])

  // If only one method is enabled, skip the selector entirely
  if (enabledMethods.length <= 1 && disabledMethods.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {enabledMethods.map((method) => {
        const Icon = ICON_MAP[method.id] || CreditCard
        const isSelected = selectedMethod === method.id

        return (
          <label
            key={method.id}
            className={`
              flex items-center gap-4 rounded-lg border-2 p-4 cursor-pointer transition-colors
              ${
                isSelected
                  ? 'border-salsa-500 bg-salsa-50'
                  : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={method.id}
              checked={isSelected}
              onChange={() => onSelect(method.id)}
              className="h-4 w-4 text-salsa-500 focus:ring-salsa-500"
            />
            <div className="flex items-center gap-3 flex-1">
              <Icon className={`h-5 w-5 ${isSelected ? 'text-salsa-600' : 'text-gray-500'}`} />
              <div className="min-w-0">
                <span className="font-medium text-gray-900">{method.label}</span>
                {method.description && (
                  <span className="block text-sm text-gray-500 sm:inline sm:ml-2">{method.description}</span>
                )}
              </div>
            </div>
          </label>
        )
      })}

      {/* Disabled / coming soon methods */}
      {disabledMethods.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-gray-400 mb-2">Coming soon</p>
          <div className="flex flex-wrap gap-2">
            {disabledMethods.map((method) => {
              const Icon = ICON_MAP[method.id] || CreditCard
              return (
                <div
                  key={method.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-400"
                >
                  <Icon className="h-4 w-4" />
                  <span>{method.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
