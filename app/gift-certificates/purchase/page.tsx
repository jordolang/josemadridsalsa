'use client'

import { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

type GiftCertificateFormState = {
  purchaserName: string
  purchaserEmail: string
  recipientName: string
  recipientEmail: string
  amount: string
  theme: string
  message: string
  nonRefundableAgreement: boolean
}

const initialFormState: GiftCertificateFormState = {
  purchaserName: '',
  purchaserEmail: '',
  recipientName: '',
  recipientEmail: '',
  amount: '',
  theme: 'GENERAL',
  message: '',
  nonRefundableAgreement: false,
}

const getCardElementOptions = (isDark: boolean) => ({
  style: {
    base: {
      color: isDark ? '#e5e7eb' : '#1f2937',
      fontSize: '16px',
      '::placeholder': {
        color: '#9ca3af',
      },
      iconColor: isDark ? '#e5e7eb' : '#374151',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: true,
} as const)

function GiftCertificatePurchaseForm() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [formState, setFormState] = useState<GiftCertificateFormState>(initialFormState)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isDark = useMemo(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  }, [])

  const amount = parseFloat(formState.amount) || 0

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked

    setFormState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!stripe || !elements) {
      setErrorMessage('Payment service is not ready. Please try again.')
      return
    }

    if (!formState.nonRefundableAgreement) {
      setErrorMessage('You must agree that gift certificates are nonrefundable.')
      return
    }

    if (amount < 1) {
      setErrorMessage('Amount must be at least $1.00.')
      return
    }

    const cardElement = elements.getElement(CardElement)

    if (!cardElement) {
      setErrorMessage('Unable to access payment field. Please refresh and try again.')
      return
    }

    setIsProcessing(true)

    try {
      const purchaseResponse = await fetch('/api/gift-certificates/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaserName: formState.purchaserName,
          purchaserEmail: formState.purchaserEmail,
          recipientName: formState.recipientName,
          recipientEmail: formState.recipientEmail,
          amount,
          theme: formState.theme,
          message: formState.message || undefined,
          nonRefundableAgreement: formState.nonRefundableAgreement,
        }),
      })

      if (!purchaseResponse.ok) {
        const error = await purchaseResponse.json()
        throw new Error(error.error || 'Unable to create gift certificate purchase.')
      }

      const { clientSecret, orderId, giftCertificateCode } = await purchaseResponse.json()

      const paymentResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: formState.purchaserName,
            email: formState.purchaserEmail,
          },
        },
      })

      if (paymentResult.error) {
        throw new Error(paymentResult.error.message || 'Payment failed.')
      }

      const paymentIntentId = paymentResult.paymentIntent?.id
      if (!paymentIntentId) {
        throw new Error('Payment could not be confirmed. Please try again.')
      }

      const completionResponse = await fetch('/api/gift-certificates/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentIntentId,
        }),
      })

      if (!completionResponse.ok) {
        const error = await completionResponse.json()
        throw new Error(error.error || 'Failed to finalize gift certificate purchase.')
      }

      router.push(
        `/gift-certificates/success?code=${giftCertificateCode}&order=${orderId}`
      )
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while processing your payment.'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Purchase Gift Certificate</h1>
        <p className="text-muted-foreground">
          Give the gift of Jose Madrid Salsa! Your recipient will receive a gift certificate they can use anytime.
        </p>
      </div>

      <Card className="bg-card surface-shadow">
        <CardHeader>
          <CardTitle>Gift Certificate Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Your Information</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="purchaserName">Your Name *</Label>
                  <Input
                    id="purchaserName"
                    name="purchaserName"
                    value={formState.purchaserName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="purchaserEmail">Your Email *</Label>
                  <Input
                    id="purchaserEmail"
                    name="purchaserEmail"
                    type="email"
                    value={formState.purchaserEmail}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Recipient Information</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="recipientName">Recipient&apos;s Name *</Label>
                  <Input
                    id="recipientName"
                    name="recipientName"
                    value={formState.recipientName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="recipientEmail">Recipient&apos;s Email *</Label>
                  <Input
                    id="recipientEmail"
                    name="recipientEmail"
                    type="email"
                    value={formState.recipientEmail}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Gift Certificate Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={formState.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minimum amount: $1.00</p>
                </div>
                <div>
                  <Label htmlFor="theme">Gift Certificate Theme *</Label>
                  <Select
                    value={formState.theme}
                    onValueChange={(value) => handleSelectChange('theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BIRTHDAY">Birthday</SelectItem>
                      <SelectItem value="BOY_CELEBRATION">Boy Celebration</SelectItem>
                      <SelectItem value="CHRISTMAS">Christmas</SelectItem>
                      <SelectItem value="GENERAL">General</SelectItem>
                      <SelectItem value="GIRL">Girl</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="message">Optional Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  value={formState.message}
                  onChange={handleInputChange}
                  placeholder="Add a personal message to your gift certificate..."
                  rows={4}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="nonRefundableAgreement"
                  name="nonRefundableAgreement"
                  checked={formState.nonRefundableAgreement}
                  onChange={handleInputChange}
                  className="mt-1 h-4 w-4 rounded border-border text-salsa-600 focus:ring-salsa-500"
                  required
                />
                <Label htmlFor="nonRefundableAgreement" className="font-normal">
                  I agree that Gift Certificates are nonrefundable *
                </Label>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Payment Details</h2>
              <div className="rounded-md border border-border p-4 bg-card/60">
                <CardElement options={getCardElementOptions(isDark)} />
              </div>
            </section>

            {errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="submit"
                className="bg-salsa-500 hover:bg-salsa-600"
                disabled={isProcessing || !stripe}
              >
                {isProcessing ? 'Processing...' : `Purchase Gift Certificate - ${formatPrice(amount)}`}
              </Button>
              <p className="text-sm text-muted-foreground">
                Your payment is secure and encrypted. The recipient will receive their gift certificate via email.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function GiftCertificatePurchasePage() {
  if (!stripePromise) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">Checkout unavailable</h1>
        <p className="text-muted-foreground">
          Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and
          STRIPE_SECRET_KEY to enable payments.
        </p>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <GiftCertificatePurchaseForm />
    </Elements>
  )
}

