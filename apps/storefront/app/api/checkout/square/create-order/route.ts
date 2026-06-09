import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateTax } from '@/lib/tax-calculator'
import { calculateShipping } from '@/lib/shipping-calculator'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { reserveMultipleProducts, releaseInventory } from '@/lib/inventory-manager'
import { getReferralFromCode } from '@/lib/fundraising/referral-tracker'

const SquareCheckoutSchema = z.object({
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

    const json = await request.json()
    const parsed = SquareCheckoutSchema.safeParse(json)

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

    // Reserve inventory atomically
    let reservationResults: Awaited<ReturnType<typeof reserveMultipleProducts>>
    try {
      reservationResults = await reserveMultipleProducts(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
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
        console.error('[Square Checkout] Tax calculation failed, using $0:', error)
      }

      // Calculate shipping server-side
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
          console.error('[Square Checkout] Failed to look up referral code:', error)
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
          paymentProvider: 'SQUARE',
          paymentChannel: 'ONLINE',
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
      for (const item of items) {
        try {
          await releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            userId: user?.id,
            notes: 'Square checkout failed - releasing reservation',
          })
        } catch (releaseError) {
          console.error('[Square Checkout] Failed to release reservation:', releaseError)
        }
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
