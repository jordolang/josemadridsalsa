import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { deriveSalesChannel } from '@/lib/orders/sales-channel'
import { emitOrderCreated } from '@/lib/orders/events'
import { getProvider } from '@/lib/payments'
import { Prisma } from '@prisma/client'
import { calculateTax } from '@/lib/tax-calculator'
import { buildShippingItems, calculateShipping } from '@/lib/shipping-calculator'
import { notifyOperators, severityFor, dedupeKeys } from '@/lib/notifications/dispatch'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { reserveMultipleProducts, releaseInventory } from '@/lib/inventory-manager'
import {
  FundraiserStoreUnavailableError,
  priceInStore,
  resolveFundraiserStore,
} from '@/lib/fundraising/store.server'
import { createOrderAccessToken } from '@/lib/orders/access-token'
import { validateDiscountCode } from '@/lib/discounts'
import { BundlePricingError, priceCartLines } from '@/lib/bundles'
import { validateGiftCertificate } from '@/lib/gift-certificates'
import { ATTRIBUTION_COOKIE, parseAttributionCookie } from '@/lib/analytics/attribution'
import { getStoreSettings, isBelowMinimumOrder, formatMinimumOrder } from '@/lib/store-settings'

const CheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive(),
        // Which mix-and-match pack this jar belongs to, and which instance of it. Only the
        // tags travel; the pack price is read from the catalogue of packs server-side, for
        // the same reason shippingCost is not accepted below.
        bundleId: z.string().optional(),
        bundleGroupId: z.string().optional(),
      })
    )
    .min(1, 'Cart is empty'),
  customer: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
  }),
  shipping: z.object({
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
  }),
  notes: z.string().optional(),
  // Only codes are accepted. The discount and gift certificate amounts are always
  // recomputed server-side, for the same reason shippingCost is not accepted below.
  discountCode: z.string().optional(),
  giftCertificateCode: z.string().optional(),
  recoveryToken: z.string().optional(),
  shippingMethod: z.string().optional(),
  // NOTE: shippingCost is intentionally NOT accepted from the client.
  // Shipping cost is always recalculated server-side to prevent tampering.
  referralCode: z.string().optional(),
  // Which fundraiser's store the cart was filled in. Only the slug travels: the prices,
  // the catalogue and the group to credit are all resolved from it server-side.
  fundraiserSlug: z.string().optional(),
})

/**
 * Raised when shipping cannot be priced. Thrown rather than returned so the post-reservation
 * handler releases the inventory this request reserved; the outer handler turns it back into
 * the specific message the customer used to get.
 */
class ShippingUnavailableError extends Error {
  constructor() {
    super('Unable to calculate shipping cost. Please try again.')
    this.name = 'ShippingUnavailableError'
  }
}

const toDecimal = (value: number) =>
  new Prisma.Decimal(value.toFixed(2))

const round2 = (value: number) => Math.round(value * 100) / 100

const generateOrderNumber = () => {
  const now = new Date()
  const datePart = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')
  const randomPart = Math.floor(Math.random() * 9000 + 1000)
  return `JMS-${datePart}-${randomPart}`
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated (guests may be allowed to checkout — see store settings)
    const user = await getCurrentUser()

    const storeSettings = await getStoreSettings()
    if (!user && !storeSettings.allowGuestCheckout) {
      return NextResponse.json(
        { error: 'Please sign in to place your order.' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = CheckoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, customer, shipping, notes, discountCode, giftCertificateCode, recoveryToken, shippingMethod, referralCode, fundraiserSlug } = parsed.data

    // Deduplicated: the same salsa can appear on more than one line — once loose and once
    // inside a pack, or in two different packs — and each is a line of its own.
    const productIds = Array.from(new Set(items.map((item) => item.productId)))
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'One or more products could not be found.' },
        { status: 400 }
      )
    }

    const productMap = new Map(products.map((product) => [product.id, product]))

    // Each fundraiser is its own store: its own catalogue, its own price per jar and its own
    // share of the proceeds. Resolved from the campaign slug and referral code here rather
    // than accepted from the client, for the same reason shipping is recomputed server-side.
    let store
    try {
      store = await resolveFundraiserStore({ fundraiserSlug, referralCode })
    } catch (error) {
      if (error instanceof FundraiserStoreUnavailableError) {
        return NextResponse.json({ error: error.message }, { status: 503 })
      }
      throw error
    }

    // A cart that says it came from a campaign must be priced by that campaign. Falling back
    // to retail would charge the supporter the wrong price and credit the group nothing.
    if (fundraiserSlug && !store) {
      return NextResponse.json(
        { error: 'This fundraiser is no longer accepting orders.' },
        { status: 400 }
      )
    }

    const storePrices = store ? priceInStore(store, productIds) : null
    if (storePrices && storePrices.unavailable.length > 0) {
      return NextResponse.json(
        {
          error:
            'One or more items are no longer sold by this fundraiser. Please remove them and try again.',
        },
        { status: 400 }
      )
    }

    let pricedItems
    try {
      pricedItems = priceCartLines(items, (line) => {
        const product = productMap.get(line.productId)
        if (!product) return 0
        // In a fundraiser store the store's price is the price; the retail catalogue price
        // is not a fallback, because it is the one figure that is certainly wrong here.
        return storePrices ? (storePrices.prices.get(product.id) ?? 0) : Number(product.price)
      })
    } catch (error) {
      if (error instanceof BundlePricingError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    let subtotal = 0
    // Explicitly typed: the tax and shipping closures below both read this, and an inferred
    // `any[]` cannot survive being captured.
    const orderItems: Array<{
      productId: string
      quantity: number
      unitPrice: Prisma.Decimal
      unitCost: Prisma.Decimal | undefined
      totalPrice: Prisma.Decimal
      productName: string
      productSku: string
      productImage: string | undefined
    }> = []

    for (const item of pricedItems) {
      const product = productMap.get(item.productId)
      if (!product) continue

      subtotal = round2(subtotal + item.lineTotal)

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: toDecimal(item.unitPrice),
        // Snapshot the cost at the moment of sale. Margin computed from the product's
        // *current* cost would silently recalculate every past order whenever a supplier
        // changes price. Null stays null — an unknown cost must not become zero.
        unitCost: product.costPrice ?? undefined,
        totalPrice: toDecimal(item.lineTotal),
        productName: product.name,
        productSku: product.sku,
        productImage: product.featuredImage ?? undefined,
      })
    }

    // Minimum order is assessed on the goods subtotal (before discounts and shipping), so a
    // discount code cannot be used to duck under the threshold.
    if (isBelowMinimumOrder(Math.round(subtotal * 100), storeSettings.minimumOrderCents)) {
      return NextResponse.json(
        { error: `Orders must total at least ${formatMinimumOrder(storeSettings.minimumOrderCents)}.` },
        { status: 400 }
      )
    }

    // Validate the discount code against the server-computed subtotal. The client sends
    // only a code; the amount is derived here so it cannot be tampered with.
    let discountAmount = 0
    let appliedDiscountCode: string | null = null
    if (discountCode) {
      const discountResult = await validateDiscountCode(discountCode, subtotal, user?.id)

      if (!discountResult.valid) {
        return NextResponse.json(
          { error: discountResult.error || 'Invalid discount code' },
          { status: 400 }
        )
      }

      appliedDiscountCode = discountResult.discountCode!.code
      // A discount can never exceed the value of the goods.
      discountAmount = Math.min(discountResult.discountAmount ?? 0, subtotal)
    }

    // Tax and shipping are assessed on what the customer actually pays for the goods.
    // With no discount this equals subtotal, so undiscounted orders are unaffected.
    const discountedSubtotal = subtotal - discountAmount

    // Reserved per product, not per line: two lines of the same salsa are two claims on one
    // stock figure, and reserving them separately checks each against the full availability.
    const reservationQuantities = new Map<string, number>()
    for (const item of items) {
      reservationQuantities.set(
        item.productId,
        (reservationQuantities.get(item.productId) ?? 0) + item.quantity
      )
    }
    const reservationLines = Array.from(reservationQuantities, ([productId, quantity]) => ({
      productId,
      quantity,
    }))

    // Reserve inventory for all items atomically before proceeding with checkout.
    // reserveMultipleProducts uses a single Serializable transaction: if any item
    // has insufficient stock the entire reservation is rolled back automatically.
    let reservationResults: Awaited<ReturnType<typeof reserveMultipleProducts>>
    try {
      reservationResults = await reserveMultipleProducts(
        reservationLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          userId: user?.id,
          notes: 'Checkout reservation',
        }))
      )
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Unable to reserve inventory' },
        { status: 400 }
      )
    }

    // Tracked so the catch below can mark the order as already-released. Without it the
    // expire-pending-orders sweep would find this PENDING order later and release a
    // reservation that has already gone back.
    let createdOrderId: string | null = null

    // Wrap all post-reservation logic so we can release reservations on any failure
    try {
    // Tax and shipping are independent: one asks Stripe, the other EasyPost, and neither
    // reads the other's answer. They used to run back to back, so a checkout waited for the
    // sum of two network round trips. Run together it waits for the slower one.
    //
    // Tax resolves rather than rejects — a tax outage is recoverable and must not block the
    // sale — while shipping throws, because an order with an unknown shipping cost is not
    // one we can take money for.
    let taxAmount = 0
    let finalShippingCost = 0
    let finalShippingMethod = 'Standard Shipping'

    const computeTax = async (): Promise<number> => {
      try {
        // Spread the discount across the line items proportionally, so tax is assessed on
        // what the customer actually pays. With no discount this factor is 1.
        const taxableFactor = subtotal > 0 ? discountedSubtotal / subtotal : 1

        const taxResult = await calculateTax({
          lineItems: orderItems.map((item, index) => ({
            amount: Math.round(Number(item.totalPrice) * taxableFactor * 100), // cents
            // Stripe Tax wants a reference unique within the calculation, and one salsa can
            // hold two lines now — loose and inside a pack, or in two packs.
            reference: `${item.productId}-${index}`,
            taxCode: 'txcd_30011000', // Food & beverage - Packaged food
          })),
          shippingAddress: {
            line1: shipping.address1,
            line2: shipping.address2,
            city: shipping.city,
            state: shipping.state,
            postalCode: shipping.postalCode,
            country: 'US',
          },
          customerEmail: customer.email,
        })

        console.log('[Checkout] Tax calculated:', {
          subtotal,
          taxAmount: taxResult.taxAmountDecimal,
          taxRate: taxResult.taxRate,
          breakdown: taxResult.taxBreakdown,
        })
        return taxResult.taxAmountDecimal
      } catch (error) {
        console.error('[Checkout] Tax calculation failed, proceeding with $0 tax:', error)
        // This used to be swallowed silently, so a bad Stripe Tax key could ship untaxed
        // orders indefinitely with nothing surfacing it. Alert operators through the canonical
        // path — deduped, so a sustained outage collapses to one row rather than one per order —
        // and continue: an untaxed order is recoverable and now visible, whereas blocking all
        // checkout on a tax outage is not. (See CHANGELOG for the hard-fail-vs-continue rationale.)
        await notifyOperators({
          type: 'INTEGRATION_FAILED',
          severity: severityFor('INTEGRATION_FAILED'),
          title: 'Tax calculation failed',
          message:
            'Stripe Tax did not return a calculation during checkout. Orders are being recorded with $0 tax until this is resolved.',
          entityType: 'integration',
          entityId: 'stripe-tax',
          link: '/admin/settings/integrations',
          dedupeKey: dedupeKeys.integrationFailed('stripe-tax'),
        })
        return 0
      }
    }

    // ALWAYS recalculate shipping server-side to prevent client-side tampering.
    // The client sends shippingMethod as a preference; we validate it against
    // the server-computed options rather than trusting the client-provided cost.
    const computeShipping = async (): Promise<{ cost: number; method: string }> => {
      try {
        const itemsWithWeights = buildShippingItems(orderItems, productMap)

        const shippingResult = await calculateShipping({
          items: itemsWithWeights,
          shippingAddress: {
            line1: shipping.address1,
            line2: shipping.address2,
            city: shipping.city,
            state: shipping.state,
            postalCode: shipping.postalCode,
            country: 'US',
          },
          subtotal: discountedSubtotal,
        })

        let cost: number
        let method: string

        // If the client selected a specific shipping method, try to match it
        // against server-computed options to use the correct cost
        if (shippingMethod && shippingResult.availableOptions?.length) {
          const matchedOption = shippingResult.availableOptions.find(
            (opt) => opt.method === shippingMethod
          )
          if (matchedOption) {
            cost = matchedOption.cost
            method = matchedOption.method
          } else {
            // Client sent an unknown method — use the server default
            cost = shippingResult.shippingCost
            method = shippingResult.shippingMethod
            console.warn('[Checkout] Client shipping method not found in options, using default:', {
              clientMethod: shippingMethod,
              serverMethod: method,
            })
          }
        } else {
          // No client preference or no options — use server default
          cost = shippingResult.shippingCost
          method = shippingResult.shippingMethod
        }

        console.log('[Checkout] Shipping calculated server-side:', {
          subtotal,
          shippingCost: cost,
          shippingMethod: method,
          estimatedDelivery: shippingResult.estimatedDelivery,
        })

        return { cost, method }
      } catch (error) {
        console.error('[Checkout] Shipping calculation failed:', error)
        // Throw rather than return: this runs inside the post-reservation block, and a bare
        // `return` here would leave the function without ever reaching the release, stranding
        // the reservation this request just took.
        throw new ShippingUnavailableError()
      }
    }

    const [resolvedTax, resolvedShipping] = await Promise.all([computeTax(), computeShipping()])
    taxAmount = resolvedTax
    finalShippingCost = resolvedShipping.cost
    finalShippingMethod = resolvedShipping.method

    // Shipping is charged on every order. There is deliberately no path that zeroes it — no
    // threshold, no discount type, no reward. See `lib/shipping-calculator.ts`.

    const amountDue = discountedSubtotal + taxAmount + finalShippingCost

    // A gift certificate is stored value, applied last against everything owed. It is
    // recorded on the order but only redeemed once payment succeeds.
    let giftCertificateAmount = 0
    let appliedGiftCertificateCode: string | null = null

    if (giftCertificateCode) {
      const giftResult = await validateGiftCertificate(giftCertificateCode, amountDue)

      if (!giftResult.valid) {
        return NextResponse.json(
          { error: giftResult.error || 'Invalid gift certificate code' },
          { status: 400 }
        )
      }

      appliedGiftCertificateCode = giftResult.code!
      giftCertificateAmount = giftResult.applicableAmount ?? 0
    }

    const total = Math.max(round2(amountDue - giftCertificateAmount), 0)

    // If recovery token provided, mark abandoned cart as recovered
    if (recoveryToken) {
      try {
        await prisma.abandonedCart.updateMany({
          where: {
            recoveryToken,
            recoveredAt: null,
          },
          data: {
            recoveredAt: new Date(),
          },
        })
      } catch (error) {
        console.error('[Checkout] Failed to mark cart as recovered:', error)
        // Don't block checkout if this fails
      }
    }

    // Attribution comes from the same store that priced the cart, so a sale can never be
    // charged at a campaign's price and credited to nobody. A campaign sale with no referral
    // code is credited to the group alone — that is a supporter who bought from the school's
    // own page rather than through one student's link.
    const participantId = store?.participantId
    const fundraiserId = store?.fundraiserId

    // First-touch marketing attribution, carried from the visitor's landing in a cookie. Parsing
    // never throws and returns null when the cookie is absent or empty, so a direct or offline
    // order simply records nothing. Spread so only the fields that exist are written.
    const attribution =
      parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE)?.value) ?? undefined

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: user?.id ?? undefined,
        guestEmail: user ? undefined : customer.email,
        guestPhone: customer.phone,
        ...(attribution ?? {}),
        shippingMethod: finalShippingMethod,
        customerNotes: notes ?? undefined,
        subtotal: toDecimal(subtotal),
        shippingCost: toDecimal(finalShippingCost),
        tax: toDecimal(taxAmount),
        discountAmount: toDecimal(discountAmount),
        discountCode: appliedDiscountCode,
        giftCertificateCode: appliedGiftCertificateCode,
        giftCertificateAmount: toDecimal(giftCertificateAmount),
        total: toDecimal(total),
        paymentStatus: 'PENDING',
        status: 'PENDING',
        salesChannel: deriveSalesChannel({ participantId, fundraiserId }),
        participantId,
        fundraiserId,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    })

    createdOrderId = order.id

    await emitOrderCreated({
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      salesChannel: order.salesChannel,
      itemCount: order.items.length,
      actorUserId: user?.id ?? null,
    })

    // Log order creation audit event
    try {
      await logAuditWithRequest(
        {
          userId: user?.id,
          action: 'create',
          entityType: 'Order',
          entityId: order.id,
          changes: {
            orderNumber: order.orderNumber,
            total: Number(order.total),
            items: orderItems.length,
            customer: user ? user.email : customer.email,
          },
        },
        request
      )
    } catch (error) {
      console.error('[Checkout] Failed to log audit:', error)
      // Don't block checkout if audit logging fails
    }

    // A gift certificate can cover the order in full, leaving nothing to charge. Stripe
    // rejects a zero-amount PaymentIntent, so skip payment entirely and let the client
    // complete the order directly.
    if (total <= 0) {
      return NextResponse.json({
        clientSecret: null,
        requiresPayment: false,
        orderId: order.id,
        orderAccessToken: createOrderAccessToken(order.id),
        amount: 0,
      })
    }

    const paymentAdapter = getProvider('STRIPE')

    // Create or retrieve provider customer for authenticated users
    // to enable saved payment methods
    let providerCustomerId: string | undefined
    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
      })

      if (dbUser?.stripeCustomerId) {
        providerCustomerId = dbUser.stripeCustomerId
      } else {
        const customerResult = await paymentAdapter.createCustomer(
          customer.email,
          `${customer.firstName} ${customer.lastName}`,
          { userId: user.id }
        )
        providerCustomerId = customerResult.providerId

        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerResult.providerId },
        })
      }
    }

    const paymentResult = await paymentAdapter.createPayment({
      amount: Math.round(total * 100),
      currency: 'usd',
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: customer.email,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
      shippingAddress: {
        line1: shipping.address1,
        line2: shipping.address2,
        city: shipping.city,
        state: shipping.state,
        postalCode: shipping.postalCode,
        country: 'US',
      },
      customerId: providerCustomerId,
      setupFutureUsage: !!providerCustomerId,
    })

    if (!paymentResult.success) {
      throw new Error(paymentResult.error || 'Payment creation failed')
    }

      return NextResponse.json({
        clientSecret: paymentResult.clientSecret,
        orderId: order.id,
        // Lets a guest (who has no account to authenticate against) read back this
        // one order on the confirmation page.
        orderAccessToken: createOrderAccessToken(order.id),
        amount: total,
      })
    } catch (postReservationError) {
      // Release all reservations in parallel on any downstream failure
      console.error('[Checkout] Post-reservation error, releasing all reservations:', postReservationError)
      const releaseResults = await Promise.allSettled(
        reservationLines.map((line) =>
          releaseInventory({
            productId: line.productId,
            quantity: line.quantity,
            userId: user?.id,
            notes: 'Checkout failed - releasing reservation',
          })
        )
      )
      for (const result of releaseResults) {
        if (result.status === 'rejected') {
          console.error('[Checkout] Failed to release reservation:', result.reason)
        }
      }
      // The reservation is back, but the order row survives this failure as PENDING.
      // Mark it so the expire-pending-orders sweep does not release it a second time.
      if (createdOrderId) {
        await prisma.order
          .updateMany({
            where: { id: createdOrderId, inventoryReleasedAt: null },
            data: { inventoryReleasedAt: new Date() },
          })
          .catch((markError) =>
            console.error('[Checkout] Failed to mark reservation released:', markError)
          )
      }
      throw postReservationError
    }
  } catch (error) {
    console.error('Checkout error:', error)
    if (error instanceof ShippingUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(
      { error: 'Unable to initiate checkout. Please try again.' },
      { status: 500 }
    )
  }
}
