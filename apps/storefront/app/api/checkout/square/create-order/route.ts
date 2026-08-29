import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { deriveSalesChannel } from '@/lib/orders/sales-channel'
import { emitOrderCreated } from '@/lib/orders/events'
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
import { getStoreSettings, isBelowMinimumOrder, formatMinimumOrder } from '@/lib/store-settings'
import { BundlePricingError, priceCartLines } from '@/lib/bundles'

const SquareCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive(),
        // Which mix-and-match pack this jar belongs to, and which instance of it. Only the
        // tags travel; the pack price is read from the catalogue of packs server-side.
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
  shippingMethod: z.string().optional(),
  referralCode: z.string().optional(),
  // Which fundraiser's store the cart was filled in. Only the slug travels: the prices,
  // the catalogue and the group to credit are all resolved from it server-side.
  fundraiserSlug: z.string().optional(),
})

const toDecimal = (value: number) =>
  new Prisma.Decimal(value.toFixed(2))

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
    const user = await getCurrentUser()

    const storeSettings = await getStoreSettings()
    if (!user && !storeSettings.allowGuestCheckout) {
      return NextResponse.json({ error: 'Please sign in to place your order.' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = SquareCheckoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, customer, shipping, notes, shippingMethod, referralCode, fundraiserSlug } = parsed.data

    // Validate products exist
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
    const orderItems = []

    for (const item of pricedItems) {
      const product = productMap.get(item.productId)
      if (!product) continue

      subtotal = Math.round((subtotal + item.lineTotal) * 100) / 100

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

    if (isBelowMinimumOrder(Math.round(subtotal * 100), storeSettings.minimumOrderCents)) {
      return NextResponse.json(
        { error: `Orders must total at least ${formatMinimumOrder(storeSettings.minimumOrderCents)}.` },
        { status: 400 }
      )
    }

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

    // Reserve inventory atomically
    let reservationResults: Awaited<ReturnType<typeof reserveMultipleProducts>>
    try {
      reservationResults = await reserveMultipleProducts(
        reservationLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          userId: user?.id,
          notes: 'Square/Cash App checkout reservation',
        }))
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to reserve inventory'
      return NextResponse.json(
        { error: message },
        { status: 400 }
      )
    }

    // Tracked so the catch below can mark the order as already-released, keeping the
    // expire-pending-orders sweep from releasing the same reservation twice.
    let createdOrderId: string | null = null

    // Wrap post-reservation logic so we can release on failure
    try {
      // Calculate tax
      let taxAmount = 0
      try {
        const taxResult = await calculateTax({
          lineItems: orderItems.map((item, index) => ({
            amount: Math.round(Number(item.totalPrice) * 100),
            // Unique within the calculation: one salsa can hold two lines, loose and in a pack.
            reference: `${item.productId}-${index}`,
            taxCode: 'txcd_30011000',
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

        taxAmount = taxResult.taxAmountDecimal
      } catch (error) {
        console.error('[Square Checkout] Tax calculation failed, proceeding with $0 tax:', error)
        // Previously swallowed silently — a bad Stripe Tax key could ship untaxed orders with
        // nothing surfacing it. Alert operators (deduped so a sustained outage is one row, not
        // one per order) and continue rather than blocking all checkout on a tax outage.
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
      }

      // Calculate shipping server-side
      let finalShippingCost = 0
      let finalShippingMethod = 'Standard Shipping'

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
          subtotal,
        })

        if (shippingMethod && shippingResult.availableOptions?.length) {
          const matchedOption = shippingResult.availableOptions.find(
            (opt) => opt.method === shippingMethod
          )
          if (matchedOption) {
            finalShippingCost = matchedOption.cost
            finalShippingMethod = matchedOption.method
          } else {
            finalShippingCost = shippingResult.shippingCost
            finalShippingMethod = shippingResult.shippingMethod
          }
        } else {
          finalShippingCost = shippingResult.shippingCost
          finalShippingMethod = shippingResult.shippingMethod
        }
      } catch (error) {
        console.error('[Square Checkout] Shipping calculation failed:', error)
        return NextResponse.json(
          { error: 'Unable to calculate shipping cost. Please try again.' },
          { status: 500 }
        )
      }

      const total = subtotal + taxAmount + finalShippingCost

      // Attribution comes from the same store that priced the cart, so a sale can never be
      // charged at a campaign's price and credited to nobody. A campaign sale with no referral
      // code is credited to the group alone — that is a supporter who bought from the school's
      // own page rather than through one student's link.
      const participantId = store?.participantId
      const fundraiserId = store?.fundraiserId

      // Create the order in DB
      const order = await prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: user?.id ?? undefined,
          guestEmail: user ? undefined : customer.email,
          guestPhone: customer.phone,
          shippingMethod: finalShippingMethod,
          customerNotes: notes ?? undefined,
          subtotal: toDecimal(subtotal),
          shippingCost: toDecimal(finalShippingCost),
          tax: toDecimal(taxAmount),
          discountAmount: toDecimal(0),
          total: toDecimal(total),
          paymentStatus: 'PENDING',
          status: 'PENDING',
          paymentProvider: 'SQUARE',
          paymentChannel: 'ONLINE',
          salesChannel: deriveSalesChannel({
            participantId,
            fundraiserId,
            paymentChannel: 'ONLINE',
          }),
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

      // Log audit event
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
            paymentProvider: 'SQUARE',
          },
        },
        request
      )

      return NextResponse.json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: total,
      })
    } catch (postReservationError) {
      // Release all reservations on any downstream failure
      console.error('[Square Checkout] Post-reservation error, releasing all reservations:', postReservationError)
      for (const line of reservationLines) {
        try {
          await releaseInventory({
            productId: line.productId,
            quantity: line.quantity,
            userId: user?.id,
            notes: 'Square checkout failed - releasing reservation',
          })
        } catch (releaseError) {
          console.error('[Square Checkout] Failed to release reservation:', releaseError)
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
            console.error('[Square Checkout] Failed to mark reservation released:', markError)
          )
      }
      throw postReservationError
    }
  } catch (error) {
    console.error('[Square Checkout] Create order error:', error)
    return NextResponse.json(
      { error: 'Unable to initiate Cash App checkout. Please try again.' },
      { status: 500 }
    )
  }
}
