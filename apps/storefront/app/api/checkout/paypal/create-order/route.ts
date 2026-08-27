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
import { getReferralFromCode } from '@/lib/fundraising/referral-tracker'
import { fundraiserUnitPrice } from '@/lib/fundraising/pricing'
import { getFundraiserPriceOverrides } from '@/lib/fundraising/pricing.server'
import { getStoreSettings, isBelowMinimumOrder, formatMinimumOrder } from '@/lib/store-settings'

const PayPalCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive(),
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
  discountCode: z.string().optional(),
  shippingMethod: z.string().optional(),
  referralCode: z.string().optional(),
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
    const parsed = PayPalCheckoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, customer, shipping, notes, shippingMethod, referralCode } = parsed.data

    // Validate products exist
    const productIds = items.map((item) => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    })

    if (products.length !== items.length) {
      return NextResponse.json(
        { error: 'One or more products could not be found.' },
        { status: 400 }
      )
    }

    const productMap = new Map(products.map((product) => [product.id, product]))

    // A fundraiser sells at its own price, and the supporter was quoted that price on the
    // fundraiser page. Resolved from the referral code here rather than accepted from the
    // client, for the same reason shipping is recomputed server-side.
    const fundraiserPrices = await getFundraiserPriceOverrides(referralCode, productIds)

    let subtotal = 0
    const orderItems = []

    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) continue

      const unitPrice = fundraiserUnitPrice(product.price, fundraiserPrices.get(product.id))
      const lineTotal = unitPrice * item.quantity
      subtotal += lineTotal

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: toDecimal(unitPrice),
        // Snapshot the cost at the moment of sale. Margin computed from the product's
        // *current* cost would silently recalculate every past order whenever a supplier
        // changes price. Null stays null — an unknown cost must not become zero.
        unitCost: product.costPrice ?? undefined,
        totalPrice: toDecimal(lineTotal),
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

    // Reserve inventory atomically
    let reservationResults: Awaited<ReturnType<typeof reserveMultipleProducts>>
    try {
      reservationResults = await reserveMultipleProducts(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          userId: user?.id,
          notes: 'PayPal checkout reservation',
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
          lineItems: orderItems.map((item) => ({
            amount: Math.round(Number(item.totalPrice) * 100),
            reference: item.productId,
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
        console.error('[PayPal Checkout] Tax calculation failed, proceeding with $0 tax:', error)
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
        console.error('[PayPal Checkout] Shipping calculation failed:', error)
        return NextResponse.json(
          { error: 'Unable to calculate shipping cost. Please try again.' },
          { status: 500 }
        )
      }

      const total = subtotal + taxAmount + finalShippingCost

      // Look up participant from referral code
      let participantId: string | undefined
      let fundraiserId: string | undefined
      if (referralCode) {
        try {
          const referralInfo = await getReferralFromCode(referralCode)
          if (referralInfo) {
            participantId = referralInfo.participantId
            fundraiserId = referralInfo.fundraiserId
          }
        } catch (error) {
          console.error('[PayPal Checkout] Failed to look up referral code:', error)
        }
      }

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
          paymentProvider: 'PAYPAL',
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

      // Create PayPal order via the adapter
      const paypalAdapter = getProvider('PAYPAL')
      const amountInCents = Math.round(total * 100)

      const paymentResult = await paypalAdapter.createPayment({
        amount: amountInCents,
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
      })

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'PayPal order creation failed')
      }

      // Store the PayPal order ID on the order for capture lookup
      await prisma.order.update({
        where: { id: order.id },
        data: {
          providerPaymentId: paymentResult.providerPaymentId,
        },
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
            paymentProvider: 'PAYPAL',
          },
        },
        request
      )

      return NextResponse.json({
        paypalOrderId: paymentResult.providerPaymentId,
        approvalUrl: paymentResult.approvalUrl,
        orderId: order.id,
        amount: total,
      })
    } catch (postReservationError) {
      // Release all reservations on any downstream failure
      console.error('[PayPal Checkout] Post-reservation error, releasing all reservations:', postReservationError)
      for (const item of items) {
        try {
          await releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            userId: user?.id,
            notes: 'PayPal checkout failed - releasing reservation',
          })
        } catch (releaseError) {
          console.error('[PayPal Checkout] Failed to release reservation:', releaseError)
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
            console.error('[PayPal Checkout] Failed to mark reservation released:', markError)
          )
      }
      throw postReservationError
    }
  } catch (error) {
    console.error('[PayPal Checkout] Create order error:', error)
    return NextResponse.json(
      { error: 'Unable to initiate PayPal checkout. Please try again.' },
      { status: 500 }
    )
  }
}
