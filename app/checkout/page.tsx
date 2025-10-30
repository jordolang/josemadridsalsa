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
import { useCartStore } from '@/lib/store/cart'
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
import Link from 'next/link'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

type CheckoutFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  postalCode: string
  notes: string
}

const initialFormState: CheckoutFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  notes: '',
}

const CardElementOptions = {
  style: {
    base: {
      color: '#1f2937',
      fontSize: '16px',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
    },
  },
  hidePostalCode: true,
}

function CheckoutForm() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const clearCart = useCartStore((state) => state.clearCart)

  const [formState, setFormState] = useState<CheckoutFormState>(initialFormState)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items]
  )

  const hasCartItems = items.length > 0

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!stripe || !elements) {
      setErrorMessage('Payment service is not ready. Please try again.')
      return
    }

    if (items.length === 0) {
      setErrorMessage('Your cart is empty.')
      return
    }

    const cardElement = elements.getElement(CardElement)

    if (!cardElement) {
      setErrorMessage('Unable to access payment field. Please refresh and try again.')
      return
    }

    setIsProcessing(true)

    try {
      const checkoutResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customer: {
            email: formState.email,
            firstName: formState.firstName,
            lastName: formState.lastName,
            phone: formState.phone || undefined,
          },
          shipping: {
            address1: formState.address1,
            address2: formState.address2 || undefined,
            city: formState.city,
            state: formState.state,
            postalCode: formState.postalCode,
          },
          notes: formState.notes || undefined,
        }),
      })

      if (!checkoutResponse.ok) {
        const error = await checkoutResponse.json()
        throw new Error(error.error || 'Unable to create payment.')
      }

      const { clientSecret, orderId } = await checkoutResponse.json()

      const paymentResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${formState.firstName} ${formState.lastName}`.trim(),
            email: formState.email,
            phone: formState.phone || undefined,
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

      const completionResponse = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentIntentId,
        }),
      })

      if (!completionResponse.ok) {
        const error = await completionResponse.json()
        throw new Error(error.error || 'Failed to finalize order.')
      }

      clearCart()
      setSuccessMessage('Payment successful!')
      router.push(`/checkout/success?order=${orderId}`)
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

  if (!hasCartItems) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
        <p className="text-gray-600 mb-8">
          Add a few jars of Jose Madrid Salsa to your cart before heading to checkout.
        </p>
        <Button asChild className="bg-salsa-500 hover:bg-salsa-600">
          <Link href="/salsas">Browse Salsas</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Contact information</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formState.firstName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formState.lastName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formState.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone (optional)</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formState.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Shipping address</h2>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="address1">Address</Label>
                      <Input
                        id="address1"
                        name="address1"
                        value={formState.address1}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address2">Apartment, suite, etc. (optional)</Label>
                      <Input
                        id="address2"
                        name="address2"
                        value={formState.address2}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formState.city}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          name="state"
                          value={formState.state}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="postalCode">ZIP code</Label>
                        <Input
                          id="postalCode"
                          name="postalCode"
                          value={formState.postalCode}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes">Order notes (optional)</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        value={formState.notes}
                        onChange={handleInputChange}
                        placeholder="Add any special requests or delivery instructions."
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Payment details</h2>
                  <div className="rounded-md border border-gray-200 p-4">
                    <CardElement options={CardElementOptions} />
                  </div>
                </section>

                {errorMessage && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}
                {successMessage && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {successMessage}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="submit"
                    className="bg-salsa-500 hover:bg-salsa-600"
                    disabled={isProcessing || !stripe}
                  >
                    {isProcessing ? 'Processing...' : 'Pay now'}
                  </Button>
                  <p className="text-sm text-gray-500">
                    Your payment is secure and encrypted. You&apos;ll receive a confirmation email
                    after checkout.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between text-sm text-gray-700"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        Qty {item.quantity} • SKU {item.sku}
                      </p>
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>{formatPrice(0)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{formatPrice(0)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t text-lg font-semibold">
              <span>Total due now</span>
              <span>{formatPrice(subtotal)}</span>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  if (!stripePromise) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Checkout unavailable</h1>
        <p className="text-gray-600">
          Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and
          STRIPE_SECRET_KEY to enable payments.
        </p>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  )
}
