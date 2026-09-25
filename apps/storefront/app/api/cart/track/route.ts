import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { SITE_CHECKOUT } from '@/lib/checkout/abandoned-cart'
import { isBigCommerceStorefrontEnabled } from '@/lib/bigcommerce/storefront'
import { REFERRAL_COOKIE_NAME } from '@/lib/fundraising/referral-tracker.server'
import { resolveFundraiserStore } from '@/lib/fundraising/store.server'

const CartItemSchema = z.object({
  id: z.string(),
  // Kept alongside the line id because a pack line is keyed by pack instance, not by product,
  // and a recovered cart has to come back as the pack the customer built — a pack that lost
  // its tags would be recovered as loose jars and charged at catalogue price.
  productId: z.string().optional(),
  name: z.string(),
  slug: z.string(),
  price: z.number(),
  image: z.string(),
  quantity: z.number().int().positive(),
  sku: z.string(),
  heatLevel: z.string(),
  maxQuantity: z.number().int().optional(),
  bundleId: z.string().optional(),
  bundleGroupId: z.string().optional(),
  bundleName: z.string().optional(),
  fundraiserSlug: z.string().optional(),
})

const TrackCartSchema = z.object({
  items: z.array(CartItemSchema),
  guestEmail: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Optional authentication - track user if logged in
    const user = await getCurrentUser()

    const payload = await request.json()
    const parsed = TrackCartSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid cart data' }, { status: 400 })
    }

    const { items, guestEmail } = parsed.data

    // Don't track empty carts
    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'Empty cart, not tracked' })
    }

    // If no user or guest email, silently skip tracking (user hasn't provided email yet)
    if (!user && !guestEmail) {
      return NextResponse.json({ success: true, message: 'Cart not tracked yet, waiting for email' })
    }

    // Once retail sells through BigCommerce, a retail cart is paid for there, and nothing on
    // this site ever learns it was bought — tracking it would send "you left something in your
    // cart" emails to people who already paid. BigCommerce runs its own reminders for those.
    // Only carts that finish on this site's checkout are tracked: a fundraiser's store, or a
    // retail cart that the shopper's referral code turns into a fundraiser sale.
    if (isBigCommerceStorefrontEnabled() && !(await checksOutOnThisSite(request, items))) {
      return NextResponse.json({ success: true, message: 'Checked out in BigCommerce, not tracked' })
    }

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const cartData = {
      items,
      totalItems,
      totalPrice,
      checkout: SITE_CHECKOUT,
    }

    // Check if there's an existing abandoned cart for this user
    const existingCart = await prisma.abandonedCart.findFirst({
      where: user
        ? { userId: user.id, recoveredAt: null }
        : { guestEmail: guestEmail?.toLowerCase(), recoveredAt: null },
      orderBy: { createdAt: 'desc' },
    })

    if (existingCart) {
      // Update existing cart
      await prisma.abandonedCart.update({
        where: { id: existingCart.id },
        data: {
          cartData,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new abandoned cart record
      await prisma.abandonedCart.create({
        data: {
          userId: user?.id,
          guestEmail: guestEmail?.toLowerCase(),
          cartData,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cart tracking error:', error)
    return NextResponse.json(
      { error: 'Unable to track cart' },
      { status: 500 }
    )
  }
}

async function checksOutOnThisSite(
  request: NextRequest,
  items: z.infer<typeof CartItemSchema>[],
): Promise<boolean> {
  if (items.some((item) => item.fundraiserSlug)) return true
  const referralCode = request.cookies.get(REFERRAL_COOKIE_NAME)?.value
  if (!referralCode) return false
  try {
    return (await resolveFundraiserStore({ referralCode })) !== null
  } catch {
    // Unknown is treated as BigCommerce: a missed reminder costs less than emailing a buyer.
    return false
  }
}
