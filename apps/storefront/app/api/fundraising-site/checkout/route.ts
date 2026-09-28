import { NextRequest, NextResponse } from 'next/server'
import { BigCommerceCartError } from '@/lib/bigcommerce/cart'
import { BigCommerceApiError } from '@/lib/bigcommerce/client'
import { isBigCommerceConfigured } from '@/lib/bigcommerce/config'
import { createFundraisingCheckout, fundraisingCheckoutRequestSchema } from '@/lib/fundraising-site/checkout'

/**
 * Builds a cart in the BigCommerce fundraising store from the fundraising
 * site's cart and returns the hosted checkout URL to send the buyer to.
 */
export async function POST(request: NextRequest) {
  if (!isBigCommerceConfigured('fundraising')) {
    return NextResponse.json({ error: 'Fundraising checkout is not configured' }, { status: 503 })
  }

  const parsed = fundraisingCheckoutRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please choose your group and enter the salesperson’s name.' }, { status: 400 })
  }

  try {
    const { checkoutUrl, prefilled } = await createFundraisingCheckout(parsed.data)
    return NextResponse.json({ checkoutUrl, prefilled })
  } catch (error) {
    if (error instanceof BigCommerceCartError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    if (error instanceof BigCommerceApiError && error.status === 422) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[bigcommerce] fundraising checkout handoff failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Checkout is unavailable right now. Please try again in a moment.' },
      { status: 502 },
    )
  }
}
