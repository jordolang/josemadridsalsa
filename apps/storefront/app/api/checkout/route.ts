import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { deriveSalesChannel } from '@/lib/orders/sales-channel'
import { emitOrderCreated } from '@/lib/orders/events'
import { getProvider } from '@/lib/payments'
import { Prisma } from '@prisma/client'
import { queueShopifySync } from '@/lib/shopify/sync'
import { calculateTax } from '@/lib/tax-calculator'
import { calculateShipping } from '@/lib/shipping-calculator'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { reserveMultipleProducts, releaseInventory } from '@/lib/inventory-manager'
import { getReferralFromCode } from '@/lib/fundraising/referral-tracker'
import { createOrderAccessToken } from '@/lib/orders/access-token'
import { validateDiscountCode } from '@/lib/discounts'
import { validateGiftCertificate } from '@/lib/gift-certificates'

const CheckoutSchema = z.object({
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
  // Only codes are accepted. The discount and gift certificate amounts are always
  // recomputed server-side, for the same reason shippingCost is not accepted below.
  discountCode: z.string().optional(),
  giftCertificateCode: z.string().optional(),
  recoveryToken: z.string().optional(),
  shippingMethod: z.string().optional(),
  // NOTE: shippingCost is intentionally NOT accepted from the client.
  // Shipping cost is always recalculated server-side to prevent tampering.
  referralCode: z.string().optional(),
})

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
    // Check if user is authenticated (optional - guests can checkout)
    const user = await getCurrentUser()

    const json = await request.json()
    const parsed = CheckoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, customer, shipping, notes, discountCode, giftCertificateCode, recoveryToken, shippingMethod, referralCode } = parsed.data

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

    let subtotal = 0
    const orderItems = []

    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) continue

      const unitPrice = Number(product.price)
      const lineTotal = unitPrice * item.quantity
      subtotal += lineTotal

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: toDecimal(unitPrice),
        totalPrice: toDecimal(lineTotal),
        productName: product.name,
        productSku: product.sku,
        productImage: product.featuredImage ?? undefined,
      })
    }

    // Validate the discount code against the server-computed subtotal. The client sends
    // only a code; the amount is derived here so it cannot be tampered with.
    let discountAmount = 0
    let appliedDiscountCode: string | null = null
    let discountGivesFreeShipping = false

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
      discountGivesFreeShipping = discountResult.discountCode!.type === 'FREE_SHIPPING'
    }

    // Tax and shipping are assessed on what the customer actually pays for the goods.
    // With no discount this equals subtotal, so undiscounted orders are unaffected.
    const discountedSubtotal = subtotal - discountAmount

    // Reserve inventory for all items atomically before proceeding with checkout.
    // reserveMultipleProducts uses a single Serializable transaction: if any item
    // has insufficient stock the entire reservation is rolled back automatically.
    let reservationResults: Awaited<ReturnType<typeof reserveMultipleProducts>>
    try {
      reservationResults = await reserveMultipleProducts(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
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

    // Wrap all post-reservation logic so we can release reservations on any failure
    try {
    // Calculate tax using Stripe Tax API
    let taxAmount = 0
    try {
      // Spread the discount across the line items proportionally, so tax is assessed on
      // what the customer actually pays. With no discount this factor is 1.
      const taxableFactor = subtotal > 0 ? discountedSubtotal / subtotal : 1

      const taxResult = await calculateTax({
        lineItems: orderItems.map((item) => ({
          amount: Math.round(Number(item.totalPrice) * taxableFactor * 100), // cents
          reference: item.productId,
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

      taxAmount = taxResult.taxAmountDecimal
      console.log('[Checkout] Tax calculated:', {
        subtotal,
        taxAmount,
        taxRate: taxResult.taxRate,
        breakdown: taxResult.taxBreakdown,
      })
    } catch (error) {
      console.error('[Checkout] Tax calculation failed, using $0:', error)
      // Continue with 0 tax rather than blocking checkout
    }

    // ALWAYS recalculate shipping server-side to prevent client-side tampering.
    // The client sends shippingMethod as a preference; we validate it against
    // the server-computed options rather than trusting the client-provided cost.
    let finalShippingCost = 0
    let finalShippingMethod = 'Standard Shipping'

    try {
      const itemsWithWeights = orderItems.map((item) => {
        const product = productMap.get(item.productId)
        return {
          weight: product?.weight ? Number(product.weight) : 1.0,
          quantity: item.quantity,
        }
      })

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

      // If the client selected a specific shipping method, try to match it
      // against server-computed options to use the correct cost
      if (shippingMethod && shippingResult.availableOptions?.length) {
        const matchedOption = shippingResult.availableOptions.find(
          (opt) => opt.method === shippingMethod
        )
        if (matchedOption) {
          finalShippingCost = matchedOption.cost
          finalShippingMethod = matchedOption.method
        } else {
          // Client sent an unknown method — use the server default
          finalShippingCost = shippingResult.shippingCost
          finalShippingMethod = shippingResult.shippingMethod
          console.warn('[Checkout] Client shipping method not found in options, using default:', {
            clientMethod: shippingMethod,
            serverMethod: finalShippingMethod,
          })
        }
      } else {
        // No client preference or no options — use server default
        finalShippingCost = shippingResult.shippingCost
        finalShippingMethod = shippingResult.shippingMethod
      }

      console.log('[Checkout] Shipping calculated server-side:', {
        subtotal,
        shippingCost: finalShippingCost,
        shippingMethod: finalShippingMethod,
        estimatedDelivery: shippingResult.estimatedDelivery,
      })
    } catch (error) {
      console.error('[Checkout] Shipping calculation failed:', error)
      return NextResponse.json(
        { error: 'Unable to calculate shipping cost. Please try again.' },
        { status: 500 }
      )
    }

    // A FREE_SHIPPING code carries no dollar discount; it zeroes the shipping line.
    if (discountGivesFreeShipping) {
      finalShippingCost = 0
    }

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

    // Look up participant from referral code if provided
    let participantId: string | undefined
    let fundraiserId: string | undefined
    if (referralCode) {
      try {
        const referralInfo = await getReferralFromCode(referralCode)
        if (referralInfo) {
          participantId = referralInfo.participantId
          fundraiserId = referralInfo.fundraiserId
          console.log('[Checkout] Order attributed to participant:', {
            participantId,
            participantName: referralInfo.participantName,
            fundraiserId,
            fundraiserName: referralInfo.fundraiserName,
          })
        } else {
          console.warn('[Checkout] Invalid or inactive referral code:', referralCode)
        }
      } catch (error) {
        console.error('[Checkout] Failed to look up referral code:', error)
        // Don't block checkout if referral lookup fails
      }
    }

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

    try {
      queueShopifySync(order.id)
    } catch (error) {
      console.error('[Checkout] Failed to queue Shopify sync:', error)
      // Don't block checkout if Shopify sync fails
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
        items.map((item) =>
          releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
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
      throw postReservationError
    }
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Unable to initiate checkout. Please try again.' },
      { status: 500 }
    )
  }
}
