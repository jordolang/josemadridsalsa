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

const CreateOrderSchema = z.object({
  cartItemIds: z
    .array(z.string().cuid())
    .min(1, 'Cart is empty'),
  shippingAddress: z.object({
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().default('US'),
  }),
  billingAddress: z.object({
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().default('US'),
  }).optional(),
  notes: z.string().optional(),
  discountCode: z.string().optional(),
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
    // Require authentication for creating orders from cart
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = CreateOrderSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid order payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { cartItemIds, shippingAddress, billingAddress, notes, discountCode } = parsed.data

    // Fetch cart items for the authenticated user
    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: cartItemIds },
        userId: user.id,
      },
      include: {
        product: true,
      },
    })

    if (cartItems.length !== cartItemIds.length) {
      return NextResponse.json(
        { error: 'One or more cart items could not be found.' },
        { status: 400 }
      )
    }

    // Build order items and calculate subtotal
    let subtotal = 0
    const orderItems = []
    const productMap = new Map(
      cartItems.map((item) => [item.productId, item.product])
    )

    for (const cartItem of cartItems) {
      const product = cartItem.product

      if (!product) {
        return NextResponse.json(
          { error: 'Product not found for cart item' },
          { status: 400 }
        )
      }

      if (product.inventory < cartItem.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient inventory for ${product.name}. Available: ${product.inventory}`,
          },
          { status: 400 }
        )
      }

      const unitPrice = Number(product.price)
      const lineTotal = unitPrice * cartItem.quantity
      subtotal += lineTotal

      orderItems.push({
        productId: product.id,
        quantity: cartItem.quantity,
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
          line1: shippingAddress.address1,
          line2: shippingAddress.address2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
        customerEmail: user.email,
      })

      taxAmount = taxResult.taxAmountDecimal
    } catch (error) {
      // Continue with 0 tax rather than blocking checkout
    }

    // Calculate shipping cost
    let shippingCost = 0
    let shippingMethod = 'Standard Shipping'
    try {
      const itemsWithWeights = orderItems.map((item) => {
        const product = productMap.get(item.productId)
        return {
          weight: product?.weight ? Number(product.weight) : 1.0,
          quantity: item.quantity,
        }
      })

      const shippingResult = calculateShipping({
        items: itemsWithWeights,
        shippingAddress: {
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
        subtotal,
      })

      shippingCost = shippingResult.shippingCost
      shippingMethod = shippingResult.shippingMethod
    } catch (error) {
      // Continue with 0 shipping rather than blocking checkout
    }

    const total = subtotal + taxAmount + shippingCost

    const shippingSummary = [
      `${shippingAddress.address1}${shippingAddress.address2 ? `, ${shippingAddress.address2}` : ''}`,
      `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postalCode}`,
    ].join('\n')

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: user.id,
        shippingMethod: shippingSummary,
        customerNotes: notes ?? undefined,
        subtotal: toDecimal(subtotal),
        shippingCost: toDecimal(shippingCost),
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
        userId: user.id,
        action: 'create',
        entityType: 'Order',
        entityId: order.id,
        changes: {
          orderNumber: order.orderNumber,
          total: Number(order.total),
          items: orderItems.length,
          customer: user.email,
        },
      },
      request
    )

    // Delete cart items after order creation
    await prisma.cartItem.deleteMany({
      where: {
        id: { in: cartItemIds },
        userId: user.id,
      },
    })

    queueShopifySync(order.id)

    const stripe = getStripe()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'usd',
      receipt_email: user.email,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: user.name ?? user.email,
      },
      shipping: {
        name: user.name ?? user.email,
        address: {
          line1: shippingAddress.address1,
          line2: shippingAddress.address2 ?? undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country: shippingAddress.country,
        },
        phone: user.phone ?? undefined,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: total,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to create order. Please try again.' },
      { status: 500 }
    )
  }
}
