import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { queueShopifySync } from '@/lib/shopify/sync'
import { calculateTax } from '@/lib/tax-calculator'
import { calculateShipping } from '@/lib/shipping-calculator'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

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
  discountCode: z.string().optional(),
  recoveryToken: z.string().optional(),
  shippingMethod: z.string().optional(),
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

    const { items, customer, shipping, notes, discountCode, recoveryToken, shippingMethod } = parsed.data

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

      if (product.inventory < item.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient inventory for ${product.name}. Available: ${product.inventory}`,
          },
          { status: 400 }
        )
      }

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

    // Calculate tax using Stripe Tax API
    let taxAmount = 0
    try {
      const taxResult = await calculateTax({
        lineItems: orderItems.map((item) => ({
          amount: Math.round(Number(item.totalPrice) * 100), // Convert to cents
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

    // Always calculate shipping server-side to prevent client manipulation
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

      // If client selected a specific shipping method, validate it against available options
      if (shippingMethod && shippingResult.availableOptions?.length) {
        const selectedOption = shippingResult.availableOptions.find(
          (opt) => opt.method === shippingMethod
        )

        if (selectedOption) {
          finalShippingCost = selectedOption.cost
          finalShippingMethod = selectedOption.method
        } else {
          // Client selected an invalid method - use server-calculated default
          finalShippingCost = shippingResult.shippingCost
          finalShippingMethod = shippingResult.shippingMethod
        }
      } else {
        finalShippingCost = shippingResult.shippingCost
        finalShippingMethod = shippingResult.shippingMethod
      }

      console.log('[Checkout] Shipping calculated:', {
        subtotal,
        shippingCost: finalShippingCost,
        shippingMethod: finalShippingMethod,
        estimatedDelivery: shippingResult.estimatedDelivery,
      })
    } catch (error) {
      console.error('[Checkout] Shipping calculation failed, using $0:', error)
      // Continue with 0 shipping rather than blocking checkout
    }

    const total = subtotal + taxAmount + finalShippingCost

    const shippingSummary = [
      `${shipping.address1}${shipping.address2 ? `, ${shipping.address2}` : ''}`,
      `${shipping.city}, ${shipping.state} ${shipping.postalCode}`,
    ].join('\n')

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
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    })

    // Log order creation audit event
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

    queueShopifySync(order.id)

    const stripe = getStripe()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'usd',
      receipt_email: customer.email,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: `${customer.firstName} ${customer.lastName}`,
      },
      shipping: {
        name: `${customer.firstName} ${customer.lastName}`,
        address: {
          line1: shipping.address1,
          line2: shipping.address2 ?? undefined,
          city: shipping.city,
          state: shipping.state,
          postal_code: shipping.postalCode,
          country: 'US',
        },
        phone: customer.phone ?? undefined,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      amount: total,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Unable to initiate checkout. Please try again.' },
      { status: 500 }
    )
  }
}
