import { NextRequest, NextResponse } from 'next/server'
import {
  BigCommerceCartError,
  bigCommerceCheckoutRequestSchema,
  createBigCommerceCheckout,
} from '@/lib/bigcommerce/cart'
import { isBigCommerceStorefrontEnabled } from '@/lib/bigcommerce/storefront'
import { BigCommerceApiError } from '@/lib/bigcommerce/client'

/**
 * Builds a BigCommerce cart from the shopper's cart and returns the hosted
 * checkout URL to send them to.
 */
export async function POST(request: NextRequest) {
  if (!isBigCommerceStorefrontEnabled()) {
    return NextResponse.json({ error: 'BigCommerce checkout is not enabled' }, { status: 404 })
  }

  const parsed = bigCommerceCheckoutRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
  }

  try {
    const { checkoutUrl } = await createBigCommerceCheckout(parsed.data.items)
    return NextResponse.json({ checkoutUrl })
  } catch (error) {
    if (error instanceof BigCommerceCartError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    // BigCommerce rejecting the cart (a 422 on stock or options) is the
    // shopper's to fix; anything else is ours.
    if (error instanceof BigCommerceApiError && error.status === 422) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[bigcommerce] checkout handoff failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Checkout is unavailable right now. Please try again in a moment.' },
      { status: 502 },
    )
  }
}
