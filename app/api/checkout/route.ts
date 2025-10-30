import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = CheckoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, customer, shipping, notes } = parsed.data

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

    const tax = 0
    const shippingCost = 0
    const total = subtotal + tax + shippingCost

    const shippingSummary = [
      `${shipping.address1}${shipping.address2 ? `, ${shipping.address2}` : ''}`,
      `${shipping.city}, ${shipping.state} ${shipping.postalCode}`,
    ].join('\n')

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        guestEmail: customer.email,
        guestPhone: customer.phone,
        shippingMethod: shippingSummary,
        customerNotes: notes ?? undefined,
        subtotal: toDecimal(subtotal),
        shippingCost: toDecimal(shippingCost),
        tax: toDecimal(tax),
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
