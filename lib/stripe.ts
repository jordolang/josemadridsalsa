import Stripe from 'stripe'

const secretKey =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY

let stripeClient: Stripe | null = null

export const getStripe = () => {
  if (!secretKey) {
    throw new Error(
      'Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in your environment.'
    )
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
    })
  }

  return stripeClient
}
