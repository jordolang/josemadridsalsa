'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  CardElement,
  Elements,
  ExpressCheckoutElement,
  LinkAuthenticationElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { useRouter } from 'next/navigation'
import { useCartStore, toCheckoutItems, cartItemProductId } from '@/lib/store/cart'
import { formatPrice } from '@/lib/utils'
import { isShippingAddressReadyForRates } from '@/lib/checkout/shipping-address'
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
import dynamic from 'next/dynamic'
import { getReferralCodeFromCookie } from '@/lib/fundraising/referral-tracker.client'
import { cartStoreContext } from '@/lib/store/cart'
import {
  PaymentMethodSelector,
  DEFAULT_METHODS,
  type PaymentMethodId,
} from '@/components/checkout/PaymentMethodSelector'


// Lazy-load payment provider components to avoid bundling PayPal (~100KB+)
// and Square (~50KB+) SDKs when the user pays with card (the default).
const PayPalProvider = dynamic(
  () => import('@/components/checkout/PayPalProvider').then((m) => ({ default: m.PayPalProvider })),
  { ssr: false }
)
const PayPalButton = dynamic(
  () => import('@/components/checkout/PayPalButton').then((m) => ({ default: m.PayPalButton })),
  { ssr: false }
)
const VenmoButton = dynamic(
  () => import('@/components/checkout/VenmoButton').then((m) => ({ default: m.VenmoButton })),
  { ssr: false }
)
const CashAppButton = dynamic(
  () => import('@/components/checkout/CashAppButton').then((m) => ({ default: m.CashAppButton })),
  { ssr: false }
)

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
  estimatedDeliveryDate?: string
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

// Map Stripe error codes to user-friendly messages
function getPaymentErrorMessage(error: any): string {
  const code = error?.code
  const declineCode = error?.decline_code

  // Handle specific decline codes
  if (declineCode) {
    switch (declineCode) {
      case 'insufficient_funds':
        return 'Your card has insufficient funds. Please use a different payment method.'
      case 'lost_card':
      case 'stolen_card':
        return 'This card has been reported as lost or stolen. Please use a different payment method.'
      case 'expired_card':
        return 'Your card has expired. Please use a different payment method.'
      case 'incorrect_cvc':
        return 'The security code (CVC) is incorrect. Please check your card and try again.'
      case 'processing_error':
        return 'An error occurred while processing your card. Please try again or use a different payment method.'
      case 'generic_decline':
        return 'Your card was declined. Please contact your card issuer or use a different payment method.'
      default:
        return 'Your card was declined. Please contact your card issuer or use a different payment method.'
    }
  }

  // Handle specific error codes
  switch (code) {
    case 'card_declined':
      return 'Your card was declined. Please contact your card issuer or use a different payment method.'
    case 'expired_card':
      return 'Your card has expired. Please use a different payment method.'
    case 'incorrect_cvc':
      return 'The security code (CVC) is incorrect. Please check your card and try again.'
    case 'processing_error':
      return 'An error occurred while processing your payment. Please try again.'
    case 'incorrect_number':
      return 'The card number is incorrect. Please check your card and try again.'
    case 'invalid_expiry_month':
    case 'invalid_expiry_year':
      return 'The expiration date is invalid. Please check your card and try again.'
    case 'invalid_cvc':
      return 'The security code (CVC) is invalid. Please check your card and try again.'
    case 'insufficient_funds':
      return 'Your card has insufficient funds. Please use a different payment method.'
    case 'card_velocity_exceeded':
      return 'You have exceeded the number of allowed transactions. Please try again later or use a different payment method.'
    case 'fraudulent':
      return 'This transaction has been flagged as potentially fraudulent. Please contact your card issuer.'
    default:
      // Return the original error message if available, otherwise a generic message
      return error?.message || 'Payment failed. Please check your card information and try again.'
  }
}

type ExpressCheckoutProps = {
  items: any[]
  formState: CheckoutFormState
  total: number
  discountCode?: string
  giftCertificateCode?: string
  onSuccess: () => void
  onError: (message: string) => void
}

function ExpressCheckout({ items, formState, total, discountCode, giftCertificateCode, onSuccess, onError }: ExpressCheckoutProps) {
  const stripe = useStripe()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)

  // Memoize checkout items transformation to avoid recalculation on every render
  const checkoutItems = useMemo(() => toCheckoutItems(items), [items])

  const handleExpressCheckoutConfirm = async (event: any) => {
    if (!stripe || items.length === 0) {
      return
    }

    setIsProcessing(true)

    try {
      // Extract shipping and billing details from the event
      const shippingAddress = event.shippingAddress?.address
      const billingDetails = event.billingDetails

      // Create payment intent for express checkout
      const checkoutResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          customer: {
            email: billingDetails?.email || formState.email || '',
            firstName: billingDetails?.name?.split(' ')[0] || formState.firstName || '',
            lastName: billingDetails?.name?.split(' ').slice(1).join(' ') || formState.lastName || '',
            phone: billingDetails?.phone || formState.phone || undefined,
          },
          shipping: {
            address1: shippingAddress?.line1 || formState.address1 || '',
            address2: shippingAddress?.line2 || formState.address2 || undefined,
            city: shippingAddress?.city || formState.city || '',
            state: shippingAddress?.state || formState.state || '',
            postalCode: shippingAddress?.postal_code || formState.postalCode || '',
          },
          notes: formState.notes || undefined,
          // Codes only; the server revalidates and recomputes the amounts. Without these
          // the order would be created at full price while the summary showed a discount.
          discountCode,
          giftCertificateCode,
        }),
      })

      if (!checkoutResponse.ok) {
        const error = await checkoutResponse.json()
        throw new Error(error.error || 'Unable to create payment.')
      }

      const { clientSecret, orderId, orderAccessToken } = await checkoutResponse.json()

      // Confirm the payment with the client secret
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements: event.elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation/${orderId}?token=${orderAccessToken}`,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        onError(getPaymentErrorMessage(confirmError))
        setIsProcessing(false)
        return
      }

      if (!paymentIntent?.id) {
        throw new Error('Payment could not be confirmed.')
      }

      // Complete the order
      const completionResponse = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentIntentId: paymentIntent.id,
        }),
      })

      if (!completionResponse.ok) {
        const error = await completionResponse.json()
        throw new Error(error.error || 'Failed to finalize order.')
      }

      onSuccess()
      router.push(`/order-confirmation/${orderId}?token=${orderAccessToken}`)
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while processing your payment.'
      )
      setIsProcessing(false)
    }
  }

  const expressCheckoutOptions = {
    buttonType: {
      applePay: 'buy' as const,
      googlePay: 'buy' as const,
    },
    wallets: {
      applePay: 'auto' as const,
      googlePay: 'auto' as const,
    },
  }

  if (items.length === 0 || total === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <ExpressCheckoutElement
        options={expressCheckoutOptions}
        onConfirm={handleExpressCheckoutConfirm}
      />
      {isProcessing && (
        <p className="text-sm text-gray-500 text-center">Processing payment...</p>
      )}
    </div>
  )
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
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [availableShippingOptions, setAvailableShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShippingOption, setSelectedShippingOption] = useState<ShippingOption | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodId>('card')
  // Discount and gift certificate codes. These are quotes only — the server revalidates
  // each code and recomputes the amounts when the order is created, so nothing here is
  // trusted for pricing.
  const [discountInput, setDiscountInput] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false)
  const [giftInput, setGiftInput] = useState('')
  const [appliedGift, setAppliedGift] = useState<{ code: string; amount: number; balance: number } | null>(null)
  const [giftError, setGiftError] = useState<string | null>(null)
  const [isApplyingGift, setIsApplyingGift] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkComplete, setLinkComplete] = useState(false)
  const [isRecoveringCart, setIsRecoveringCart] = useState(false)
  const taxCalcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shippingCalcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const taxAbortRef = useRef<AbortController | null>(null)
  const shippingAbortRef = useRef<AbortController | null>(null)
  const hasRecoveredRef = useRef(false)
  // Always-current formState for the debounced tax/shipping calculators. Their
  // setTimeout callbacks capture the render in which the keystroke fired, so
  // reading `formState` directly there is one keystroke stale — a freshly
  // completed ZIP would still be seen as incomplete. Read this ref instead.
  const latestFormRef = useRef(formState)
  latestFormRef.current = formState

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items]
  )

  // Memoize checkout items transformation to avoid recalculation on every render
  const checkoutItems = useMemo(() => toCheckoutItems(items), [items])

  // Memoize tax calculation items transformation
  const taxCalculationItems = useMemo(
    () =>
      items.map((item) => ({
        productId: cartItemProductId(item),
        quantity: item.quantity,
        price: item.price,
      })),
    [items]
  )

  const hasCartItems = items.length > 0

  // Mirrors the server's arithmetic in /api/checkout: discount comes off the goods, then
  // shipping and tax, then the gift certificate is applied against everything owed.
  const discountAmount = Math.min(appliedDiscount?.amount ?? 0, subtotal)
  const amountDue = Math.max(subtotal - discountAmount + shippingCost + taxAmount, 0)
  const giftCertificateAmount = Math.min(appliedGift?.amount ?? 0, amountDue)
  const orderTotal = Math.max(amountDue - giftCertificateAmount, 0)

  // PayPal, Venmo and Cash App create their orders through their own endpoints, which do
  // not apply discount or gift certificate codes. Offering them with a code applied would
  // charge the customer the undiscounted total while the summary showed a discount, so
  // they are disabled until the code is removed.
  const hasCodeApplied = Boolean(appliedDiscount || appliedGift)
  const paymentMethods = useMemo(
    () =>
      DEFAULT_METHODS.map((method) =>
        hasCodeApplied && method.id !== 'card' && method.id !== 'link'
          ? { ...method, enabled: false }
          : method
      ),
    [hasCodeApplied]
  )

  // A wallet method selected before a code was applied would otherwise stay selected and
  // charge the undiscounted total.
  useEffect(() => {
    if (hasCodeApplied && selectedPaymentMethod !== 'card' && selectedPaymentMethod !== 'link') {
      setSelectedPaymentMethod('card')
    }
  }, [hasCodeApplied, selectedPaymentMethod])

  const handleApplyDiscount = async () => {
    const code = discountInput.trim()
    if (!code) return

    setIsApplyingDiscount(true)
    setDiscountError(null)

    try {
      const response = await fetch('/api/checkout/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartTotal: subtotal }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        setAppliedDiscount(null)
        setDiscountError(data.error || 'This discount code could not be applied.')
        return
      }

      setAppliedDiscount({ code: data.discountCode.code, amount: data.discountAmount ?? 0 })
      setDiscountInput('')
    } catch {
      setDiscountError('Could not check that code. Please try again.')
    } finally {
      setIsApplyingDiscount(false)
    }
  }

  const handleApplyGiftCertificate = async () => {
    const code = giftInput.trim()
    if (!code) return

    setIsApplyingGift(true)
    setGiftError(null)

    try {
      const response = await fetch('/api/checkout/apply-gift-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartTotal: amountDue }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setAppliedGift(null)
        setGiftError(data.error || 'This gift certificate could not be applied.')
        return
      }

      setAppliedGift({
        code: data.code,
        amount: parseFloat(data.applicableAmount),
        balance: parseFloat(data.balance),
      })
      setGiftInput('')
    } catch {
      setGiftError('Could not check that certificate. Please try again.')
    } finally {
      setIsApplyingGift(false)
    }
  }

  // Calculate tax when address is complete
  const calculateTaxEstimate = async () => {
    const form = latestFormRef.current
    // Only calculate once the address can actually pass server validation
    // (state >= 2 chars, postalCode >= 5). Firing mid-typing produces requests
    // the API rejects; mirror the same readiness gate used for shipping.
    if (!isShippingAddressReadyForRates(form) || items.length === 0) {
      return
    }

    // Abort any in-flight tax calculation to prevent stale responses
    taxAbortRef.current?.abort()
    const controller = new AbortController()
    taxAbortRef.current = controller

    setIsCalculatingTax(true)
    try {
      const response = await fetch('/api/checkout/calculate-tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          items: taxCalculationItems,
          shippingAddress: {
            address1: form.address1,
            address2: form.address2 || undefined,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
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
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Error calculating tax:', error)
      setTaxAmount(0)
    } finally {
      setIsCalculatingTax(false)
    }
  }

  // Calculate shipping when address is complete
  const calculateShippingEstimate = async () => {
    const form = latestFormRef.current
    // Only calculate once the address can actually pass server validation.
    // The calculate-shipping route requires state >= 2 chars and postalCode
    // >= 5 chars, so firing while the customer is still typing returns a 400
    // "Invalid shipping calculation request". Mirror those minimums here.
    if (!isShippingAddressReadyForRates(form) || items.length === 0) {
      return
    }

    // Abort any in-flight shipping calculation to prevent stale responses
    shippingAbortRef.current?.abort()
    const controller = new AbortController()
    shippingAbortRef.current = controller

    setIsCalculatingShipping(true)
    setShippingError(null)
    try {
      const response = await fetch('/api/checkout/calculate-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          items: checkoutItems,
          shippingAddress: {
            address1: form.address1,
            address2: form.address2 || undefined,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: 'US',
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Clear any error left over from an earlier failed attempt so a
        // successful recalculation self-heals the on-screen message.
        setShippingError(null)
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
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error || 'Unable to calculate shipping costs'
        setShippingError(errorMsg)
        setShippingCost(0)
        setAvailableShippingOptions([])
        setSelectedShippingOption(null)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShippingError('Unable to calculate shipping costs. Please try again.')
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
    // Note: address1 excluded intentionally - carrier APIs use city/state/zip for rate calculation
    if (['city', 'state', 'postalCode'].includes(name)) {
      // Clear previous timeouts and errors
      if (taxCalcTimeoutRef.current) {
        clearTimeout(taxCalcTimeoutRef.current)
      }
      if (shippingCalcTimeoutRef.current) {
        clearTimeout(shippingCalcTimeoutRef.current)
      }
      setShippingError(null)
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

  // Cleanup timeouts and abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (taxCalcTimeoutRef.current) {
        clearTimeout(taxCalcTimeoutRef.current)
      }
      if (shippingCalcTimeoutRef.current) {
        clearTimeout(shippingCalcTimeoutRef.current)
      }
      taxAbortRef.current?.abort()
      shippingAbortRef.current?.abort()
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

    // For card payments, verify the card element is mounted
    if (selectedPaymentMethod === 'card') {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        setErrorMessage('Unable to access payment field. Please refresh and try again.')
        return
      }
    }

    setIsProcessing(true)

    try {
      // Get referral code from cookie if available
      const referralCode = getReferralCodeFromCookie()
      // Which store the cart was filled in. A fundraiser cart is priced and credited through
      // its campaign; the referral code only names the student within it, and a supporter who
      // bought from the campaign page itself has none.
      const cartStore = cartStoreContext(items)

      const checkoutResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          customer: {
            email: selectedPaymentMethod === 'link' ? (linkEmail || formState.email) : formState.email,
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
          // Codes only. The server revalidates them and recomputes the amounts.
          discountCode: appliedDiscount?.code,
          giftCertificateCode: appliedGift?.code,
          referralCode: referralCode || undefined,
          fundraiserSlug: cartStore?.slug,
          paymentMethod: selectedPaymentMethod === 'link' ? 'link' : undefined,
        }),
      })

      if (!checkoutResponse.ok) {
        const error = await checkoutResponse.json()
        throw new Error(error.error || 'Unable to create payment.')
      }

      const { clientSecret, orderId, orderAccessToken, requiresPayment } =
        await checkoutResponse.json()

      // A gift certificate can cover the order in full, leaving nothing to charge. There
      // is no PaymentIntent to confirm, so complete the order directly.
      if (requiresPayment === false) {
        const freeCompletion = await fetch('/api/checkout/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })

        if (!freeCompletion.ok) {
          const error = await freeCompletion.json()
          throw new Error(error.error || 'Unable to complete your order.')
        }

        clearCart()
        setSuccessMessage('Payment successful!')
        router.push(`/order-confirmation/${orderId}?token=${orderAccessToken}`)
        return
      }

      let paymentResult

      if (selectedPaymentMethod === 'link') {
        // Link payment: confirm with elements (LinkAuthenticationElement handles the flow)
        paymentResult = await stripe.confirmPayment({
          clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/order-confirmation/${orderId}?token=${orderAccessToken}`,
            payment_method_data: {
              billing_details: {
                name: `${formState.firstName} ${formState.lastName}`.trim(),
                email: linkEmail || formState.email,
                phone: formState.phone || undefined,
              },
            },
          },
          redirect: 'if_required',
        })
      } else {
        // Card payment
        const cardElement = elements.getElement(CardElement)!
        paymentResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: `${formState.firstName} ${formState.lastName}`.trim(),
              email: formState.email,
              phone: formState.phone || undefined,
            },
          },
        })
      }

      if (paymentResult.error) {
        throw new Error(getPaymentErrorMessage(paymentResult.error))
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
      router.push(`/order-confirmation/${orderId}?token=${orderAccessToken}`)
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Contact information</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName" className="text-base">First name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formState.firstName}
                        onChange={handleInputChange}
                        autoComplete="given-name"
                        className="h-12 text-base"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-base">Last name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formState.lastName}
                        onChange={handleInputChange}
                        autoComplete="family-name"
                        className="h-12 text-base"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="email" className="text-base">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        inputMode="email"
                        value={formState.email}
                        onChange={handleInputChange}
                        autoComplete="email"
                        className="h-12 text-base"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-base">Phone (optional)</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        value={formState.phone}
                        onChange={handleInputChange}
                        autoComplete="tel"
                        className="h-12 text-base"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Shipping address</h2>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="address1" className="text-base">Address</Label>
                      <Input
                        id="address1"
                        name="address1"
                        value={formState.address1}
                        onChange={handleInputChange}
                        autoComplete="address-line1"
                        className="h-12 text-base"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address2" className="text-base">Apartment, suite, etc. (optional)</Label>
                      <Input
                        id="address2"
                        name="address2"
                        value={formState.address2}
                        onChange={handleInputChange}
                        autoComplete="address-line2"
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="city" className="text-base">City</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formState.city}
                          onChange={handleInputChange}
                          autoComplete="address-level2"
                          className="h-12 text-base"
                          required
                        />
                      </div>
                      <div className="grid gap-4 grid-cols-2">
                        <div>
                          <Label htmlFor="state" className="text-base">State</Label>
                          <Input
                            id="state"
                            name="state"
                            value={formState.state}
                            onChange={handleInputChange}
                            autoComplete="address-level1"
                            className="h-12 text-base"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="postalCode" className="text-base">ZIP code</Label>
                          <Input
                            id="postalCode"
                            name="postalCode"
                            inputMode="numeric"
                            value={formState.postalCode}
                            onChange={handleInputChange}
                            autoComplete="postal-code"
                            className="h-12 text-base"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes" className="text-base">Order notes (optional)</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        value={formState.notes}
                        onChange={handleInputChange}
                        placeholder="Add any special requests or delivery instructions."
                        className="min-h-24 text-base"
                      />
                    </div>
                  </div>
                </section>

                {(availableShippingOptions.length > 0 || isCalculatingShipping || shippingError) && (
                  <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Shipping method</h2>

                    {isCalculatingShipping ? (
                      <div className="flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-salsa-500"></div>
                        <span className="text-sm text-gray-600">Calculating shipping options...</span>
                      </div>
                    ) : shippingError ? (
                      <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-700">{shippingError}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableShippingOptions.map((option, index) => (
                          <label
                            key={index}
                            className={`
                              flex items-start gap-4 rounded-lg border-2 p-4 min-h-[60px] cursor-pointer transition-colors
                              ${
                                selectedShippingOption?.method === option.method
                                  ? 'border-salsa-500 bg-salsa-50'
                                  : 'border-gray-200 hover:border-gray-300 active:border-gray-400'
                              }
                            `}
                          >
                            <input
                              type="radio"
                              name="shippingOption"
                              value={option.method}
                              checked={selectedShippingOption?.method === option.method}
                              onChange={() => handleShippingOptionChange(option)}
                              className="mt-1 h-5 w-5 text-salsa-500 focus:ring-salsa-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="font-medium text-gray-900 text-base">{option.method}</span>
                                <span className="font-semibold text-gray-900 text-base">
                                  {option.cost === 0 ? 'FREE' : formatPrice(option.cost)}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-600">
                                {option.estimatedDeliveryDate
                                  ? `Est. delivery: ${new Date(option.estimatedDeliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                                  : `Estimated delivery: ${option.estimatedDays}`}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">Payment details</h2>

                  {/* Express Checkout (Apple Pay / Google Pay) */}
                  <ExpressCheckout
                    items={items}
                    formState={formState}
                    total={orderTotal}
                    discountCode={appliedDiscount?.code}
                    giftCertificateCode={appliedGift?.code}
                    onSuccess={() => {
                      clearCart()
                      setSuccessMessage('Payment successful!')
                    }}
                    onError={(message) => setErrorMessage(message)}
                  />

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">Or pay with</span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <PaymentMethodSelector
                    methods={paymentMethods}
                    selectedMethod={selectedPaymentMethod}
                    onSelect={setSelectedPaymentMethod}
                  />

                  {/* Card Payment Form - shown when card is selected */}
                  {selectedPaymentMethod === 'card' && (
                    <div className="rounded-md border border-gray-200 p-4">
                      <CardElement options={CardElementOptions} />
                    </div>
                  )}

                  {/* Link by Stripe - one-click checkout */}
                  {selectedPaymentMethod === 'link' && (
                    <div className="space-y-3">
                      <div className="rounded-md border border-gray-200 p-4">
                        <LinkAuthenticationElement
                          onChange={(event) => {
                            setLinkEmail(event.value?.email || '')
                            setLinkComplete(event.complete)
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Link securely saves your payment info for faster checkout across Stripe-powered stores.
                      </p>
                    </div>
                  )}

                  {/* PayPal/Venmo - provider only mounts when selected */}
                  {(selectedPaymentMethod === 'paypal' || selectedPaymentMethod === 'venmo') && (
                    <PayPalProvider>
                      {selectedPaymentMethod === 'paypal' && (
                        <PayPalButton
                          items={items}
                          customer={{
                            email: formState.email,
                            firstName: formState.firstName,
                            lastName: formState.lastName,
                            phone: formState.phone || undefined,
                          }}
                          shipping={{
                            address1: formState.address1,
                            address2: formState.address2 || undefined,
                            city: formState.city,
                            state: formState.state,
                            postalCode: formState.postalCode,
                          }}
                          notes={formState.notes || undefined}
                          shippingMethod={selectedShippingOption?.method}
                          referralCode={getReferralCodeFromCookie() || undefined}
                          fundraiserSlug={cartStoreContext(items)?.slug}
                          disabled={isProcessing}
                          onSuccess={(orderId, orderAccessToken) => {
                            clearCart()
                            setSuccessMessage('Payment successful!')
                            router.push(`/order-confirmation/${orderId}?token=${orderAccessToken}`)
                          }}
                          onError={(message) => setErrorMessage(message)}
                        />
                      )}
                      {selectedPaymentMethod === 'venmo' && (
                        <VenmoButton
                          items={items}
                          customer={{
                            email: formState.email,
                            firstName: formState.firstName,
                            lastName: formState.lastName,
                            phone: formState.phone || undefined,
                          }}
                          shipping={{
                            address1: formState.address1,
                            address2: formState.address2 || undefined,
                            city: formState.city,
                            state: formState.state,
                            postalCode: formState.postalCode,
                          }}
                          notes={formState.notes || undefined}
                          shippingMethod={selectedShippingOption?.method}
                          referralCode={getReferralCodeFromCookie() || undefined}
                          fundraiserSlug={cartStoreContext(items)?.slug}
                          disabled={isProcessing}
                          onSuccess={(orderId, orderAccessToken) => {
                            clearCart()
                            setSuccessMessage('Payment successful!')
                            router.push(`/order-confirmation/${orderId}?token=${orderAccessToken}`)
                          }}
                          onError={(message) => setErrorMessage(message)}
                        />
                      )}
                    </PayPalProvider>
                  )}

                  {/* Cash App Pay Button - shown when Cash App is selected */}
                  {selectedPaymentMethod === 'cashapp' && (
                    <CashAppButton
                      items={items}
                      customer={{
                        email: formState.email,
                        firstName: formState.firstName,
                        lastName: formState.lastName,
                        phone: formState.phone || undefined,
                      }}
                      shipping={{
                        address1: formState.address1,
                        address2: formState.address2 || undefined,
                        city: formState.city,
                        state: formState.state,
                        postalCode: formState.postalCode,
                      }}
                      total={orderTotal}
                      notes={formState.notes || undefined}
                      shippingMethod={selectedShippingOption?.method}
                      referralCode={getReferralCodeFromCookie() || undefined}
                      fundraiserSlug={cartStoreContext(items)?.slug}
                      disabled={isProcessing}
                      onSuccess={(orderId, orderAccessToken) => {
                        clearCart()
                        setSuccessMessage('Payment successful!')
                        router.push(`/order-confirmation/${orderId}?token=${orderAccessToken}`)
                      }}
                      onError={(message) => setErrorMessage(message)}
                    />
                  )}
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

                <div className="flex flex-col gap-4">
                  {(selectedPaymentMethod === 'card' || selectedPaymentMethod === 'link') && (
                  <Button
                    type="submit"
                    className="w-full sm:w-auto bg-salsa-500 hover:bg-salsa-600 h-12 text-base font-semibold"
                    disabled={isProcessing || !stripe || (selectedPaymentMethod === 'link' && !linkComplete)}
                  >
                    {isProcessing
                      ? 'Processing...'
                      : selectedPaymentMethod === 'link'
                        ? 'Pay with Link'
                        : 'Pay now'}
                  </Button>
                  )}
                  <p className="text-sm text-gray-500 text-center sm:text-left">
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
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-4">
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
                      {item.bundleName && (
                        <p className="text-xs text-salsa-600">Part of your {item.bundleName}</p>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-3 text-sm">
                <div className="space-y-2">
                  <label htmlFor="discount-code" className="text-xs font-medium text-gray-700">
                    Discount code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="discount-code"
                      value={discountInput}
                      onChange={(event) => setDiscountInput(event.target.value)}
                      placeholder="Enter code"
                      disabled={isApplyingDiscount}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleApplyDiscount()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyDiscount}
                      disabled={isApplyingDiscount || !discountInput.trim()}
                    >
                      {isApplyingDiscount ? 'Checking...' : 'Apply'}
                    </Button>
                  </div>
                  {discountError && <p className="text-xs text-red-600">{discountError}</p>}
                  {appliedDiscount && (
                    <p className="text-xs text-green-600">
                      Code {appliedDiscount.code} applied.{' '}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setAppliedDiscount(null)
                          setDiscountError(null)
                        }}
                      >
                        Remove
                      </button>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="gift-code" className="text-xs font-medium text-gray-700">
                    Gift certificate
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="gift-code"
                      value={giftInput}
                      onChange={(event) => setGiftInput(event.target.value)}
                      placeholder="Enter certificate code"
                      disabled={isApplyingGift}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleApplyGiftCertificate()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApplyGiftCertificate}
                      disabled={isApplyingGift || !giftInput.trim()}
                    >
                      {isApplyingGift ? 'Checking...' : 'Apply'}
                    </Button>
                  </div>
                  {giftError && <p className="text-xs text-red-600">{giftError}</p>}
                  {appliedGift && (
                    <p className="text-xs text-green-600">
                      Certificate {appliedGift.code} applied ({formatPrice(appliedGift.balance)} balance).{' '}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setAppliedGift(null)
                          setGiftError(null)
                        }}
                      >
                        Remove
                      </button>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-green-600">
                    <span>Discount{appliedDiscount ? ` (${appliedDiscount.code})` : ''}</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-gray-600">
                  <span>Shipping {isCalculatingShipping && <span className="text-xs">(calculating...)</span>}</span>
                  <span>{shippingCost === 0 && availableShippingOptions.length > 0 ? 'FREE' : formatPrice(shippingCost)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Tax {isCalculatingTax && <span className="text-xs">(calculating...)</span>}</span>
                  <span>{formatPrice(taxAmount)}</span>
                </div>
                {giftCertificateAmount > 0 && (
                  <div className="flex items-center justify-between text-green-600">
                    <span>Gift certificate{appliedGift ? ` (${appliedGift.code})` : ''}</span>
                    <span>-{formatPrice(giftCertificateAmount)}</span>
                  </div>
                )}
                {!isCalculatingShipping && availableShippingOptions.length === 0 && formState.postalCode.length >= 5 && (
                  <p className="text-xs text-gray-500 italic">
                    Enter your full address to calculate shipping
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t text-base sm:text-lg font-semibold px-4 sm:px-6">
              <span>Total due now</span>
              <span>{formatPrice(orderTotal)}</span>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const items = useCartStore((state) => state.items)
  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items]
  )
  // Stripe requires amount in cents; minimum 50 cents
  const totalAmount = Math.max(50, Math.round(subtotal * 100))

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
    <Elements stripe={stripePromise} options={{ mode: 'payment', amount: totalAmount, currency: 'usd' }}>
      <CheckoutForm />
    </Elements>
  )
}
