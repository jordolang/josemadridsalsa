'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
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

type ShippingOption = {
  method: string
  cost: number
  estimatedDays: string
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
  const addItem = useCartStore((state) => state.addItem)
  const setGuestEmail = useCartStore((state) => state.setGuestEmail)

  const [formState, setFormState] = useState<CheckoutFormState>(initialFormState)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [taxAmount, setTaxAmount] = useState(0)
  const [isCalculatingTax, setIsCalculatingTax] = useState(false)
  const [shippingCost, setShippingCost] = useState(0)
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false)
  const [availableShippingOptions, setAvailableShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShippingOption, setSelectedShippingOption] = useState<ShippingOption | null>(null)
  const [isRecoveringCart, setIsRecoveringCart] = useState(false)
  const taxCalcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shippingCalcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasRecoveredRef = useRef(false)

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items]
  )

  const hasCartItems = items.length > 0

  // Calculate tax when address is complete
  const calculateTaxEstimate = async () => {
    // Only calculate if we have required address fields
    if (!formState.city || !formState.state || !formState.postalCode || items.length === 0) {
      return
    }

    setIsCalculatingTax(true)
    try {
      const response = await fetch('/api/checkout/calculate-tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
          shippingAddress: {
            address1: formState.address1 || '123 Main St', // Placeholder if not entered yet
            address2: formState.address2 || undefined,
            city: formState.city,
            state: formState.state,
            postalCode: formState.postalCode,
            country: 'US',
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setTaxAmount(data.tax || 0)
      } else {
        console.error('Failed to calculate tax')
        setTaxAmount(0)
      }
    } catch (error) {
      console.error('Error calculating tax:', error)
      setTaxAmount(0)
    } finally {
      setIsCalculatingTax(false)
    }
  }

  // Calculate shipping when address is complete
  const calculateShippingEstimate = async () => {
    if (!formState.city || !formState.state || !formState.postalCode || items.length === 0) {
      return
    }

    setIsCalculatingShipping(true)
    try {
      const response = await fetch('/api/checkout/calculate-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          shippingAddress: {
            address1: formState.address1 || '123 Main St',
            address2: formState.address2 || undefined,
            city: formState.city,
            state: formState.state,
            postalCode: formState.postalCode,
            country: 'US',
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const options = data.availableOptions || []
        setAvailableShippingOptions(options)

        // Select the first option by default (usually the cheapest/standard option)
        if (options.length > 0) {
          const firstOption = options[0]
          setSelectedShippingOption(firstOption)
          setShippingCost(firstOption.cost)
        } else {
          setShippingCost(data.shippingCost || 0)
          setSelectedShippingOption(null)
        }
      } else {
        console.error('Failed to calculate shipping')
        setShippingCost(0)
        setAvailableShippingOptions([])
        setSelectedShippingOption(null)
      }
    } catch (error) {
      console.error('Error calculating shipping:', error)
      setShippingCost(0)
      setAvailableShippingOptions([])
      setSelectedShippingOption(null)
    } finally {
      setIsCalculatingShipping(false)
    }
  }

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Track guest email for abandoned cart recovery
    if (name === 'email' && value.includes('@')) {
      setGuestEmail(value)
    }

    // Trigger tax and shipping calculation when address fields change
    if (['city', 'state', 'postalCode'].includes(name)) {
      // Clear previous timeouts
      if (taxCalcTimeoutRef.current) {
        clearTimeout(taxCalcTimeoutRef.current)
      }
      if (shippingCalcTimeoutRef.current) {
        clearTimeout(shippingCalcTimeoutRef.current)
      }
      // Debounce calculations to avoid excessive API calls
      taxCalcTimeoutRef.current = setTimeout(() => {
        calculateTaxEstimate()
      }, 800)
      shippingCalcTimeoutRef.current = setTimeout(() => {
        calculateShippingEstimate()
      }, 800)
    }
  }

  const handleShippingOptionChange = (option: ShippingOption) => {
    setSelectedShippingOption(option)
    setShippingCost(option.cost)
  }

  // Handle cart recovery from abandoned cart email
  useEffect(() => {
    const recoverCart = async () => {
      // Only recover once
      if (hasRecoveredRef.current) return

      const params = new URLSearchParams(window.location.search)
      const recoveryToken = params.get('recover')

      if (!recoveryToken) return

      hasRecoveredRef.current = true
      setIsRecoveringCart(true)

      try {
        const response = await fetch(`/api/cart/recover?token=${recoveryToken}`)
        const data = await response.json()

        if (response.ok && data.success && data.cart?.items) {
          // Clear current cart and add recovered items
          clearCart()
          data.cart.items.forEach((item: any) => {
            addItem(item)
          })

          setSuccessMessage('Your cart has been restored! Complete your order below.')

          // Remove recovery token from URL
          const url = new URL(window.location.href)
          url.searchParams.delete('recover')
          window.history.replaceState({}, '', url.toString())
        } else {
          console.error('Cart recovery failed:', data.error)
        }
      } catch (error) {
        console.error('Error recovering cart:', error)
      } finally {
        setIsRecoveringCart(false)
      }
    }

    recoverCart()
  }, [addItem, clearCart])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (taxCalcTimeoutRef.current) {
        clearTimeout(taxCalcTimeoutRef.current)
      }
      if (shippingCalcTimeoutRef.current) {
        clearTimeout(shippingCalcTimeoutRef.current)
      }
    }
  }, [])

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
          shippingMethod: selectedShippingOption?.method,
          shippingCost: selectedShippingOption?.cost,
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

                {availableShippingOptions.length > 0 && (
                  <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Shipping method</h2>
                    <div className="space-y-3">
                      {availableShippingOptions.map((option, index) => (
                        <label
                          key={index}
                          className={`
                            flex items-start gap-4 rounded-lg border-2 p-4 cursor-pointer transition-colors
                            ${
                              selectedShippingOption?.method === option.method
                                ? 'border-salsa-500 bg-salsa-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }
                          `}
                        >
                          <input
                            type="radio"
                            name="shippingOption"
                            value={option.method}
                            checked={selectedShippingOption?.method === option.method}
                            onChange={() => handleShippingOptionChange(option)}
                            className="mt-1 h-4 w-4 text-salsa-500 focus:ring-salsa-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{option.method}</span>
                              <span className="font-semibold text-gray-900">
                                {option.cost === 0 ? 'FREE' : formatPrice(option.cost)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              Estimated delivery: {option.estimatedDays}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {isCalculatingShipping && (
                      <p className="text-sm text-gray-500 italic">
                        Calculating shipping options...
                      </p>
                    )}
                  </section>
                )}

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
                  <span>Shipping {isCalculatingShipping && <span className="text-xs">(calculating...)</span>}</span>
                  <span>{shippingCost === 0 && subtotal >= 50 ? 'FREE' : formatPrice(shippingCost)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Tax {isCalculatingTax && <span className="text-xs">(calculating...)</span>}</span>
                  <span>{formatPrice(taxAmount)}</span>
                </div>
                {shippingCost === 0 && subtotal >= 50 && availableShippingOptions.length > 0 && (
                  <p className="text-xs text-green-600 font-medium">
                    🎉 Free shipping on orders over $50!
                  </p>
                )}
                {!isCalculatingShipping && availableShippingOptions.length === 0 && formState.postalCode.length >= 5 && (
                  <p className="text-xs text-gray-500 italic">
                    Enter your full address to calculate shipping
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t text-lg font-semibold">
              <span>Total due now</span>
              <span>{formatPrice(subtotal + shippingCost + taxAmount)}</span>
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
