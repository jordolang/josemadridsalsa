import Stripe from 'stripe'

const secretKey =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY

if (!secretKey) {
  throw new Error(
    'Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in your environment.'
  )
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2024-06-20',
})
