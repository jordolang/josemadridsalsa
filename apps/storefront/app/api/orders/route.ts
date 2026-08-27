import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getStripe } from '@/lib/stripe'
import { calculateTax } from '@/lib/tax-calculator'
import { calculateShipping } from '@/lib/shipping-calculator'
import { notifyOperators, severityFor, dedupeKeys } from '@/lib/notifications/dispatch'
import { logAuditWithRequest } from '@/lib/audit'
import { rateLimit } from '@/lib/rateLimit'
import { CreateOrderSchema, OrderQuerySchema } from '@/lib/validations/orders'

const toDecimal = (value: number) =>
  new Prisma.Decimal(value.toFixed(2))

const generateOrderNumber = () => {
  const now = new Date()
  const datePart = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')
  // Use crypto.randomUUID for collision-resistant identifiers
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `JMS-${datePart}-${randomPart}`
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`orders:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    )
  }

  const parsed = CreateOrderSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid order payload' },
      { status: 422 },
    )
  }

  const { cartItemIds, shippingAddress, billingAddress, notes } = parsed.data
  const userId = session.user.id
  const userEmail = session.user.email ?? ''
  const userName = session.user.name ?? userEmail

  try {
    const cartItems = await db.cartItem.findMany({
    where: {
      id: { in: cartItemIds },
      userId,
    },
    include: {
      product: true,
    },
  })

  if (cartItems.length !== cartItemIds.length) {
    return NextResponse.json(
      { success: false, error: 'One or more cart items could not be found' },
      { status: 422 },
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
        { success: false, error: 'Product not found for cart item' },
        { status: 422 },
      )
    }

    if (product.inventory < cartItem.quantity) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient inventory for ${product.name}. Available: ${product.inventory}`,
        },
        { status: 422 },
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
        amount: Math.round(Number(item.totalPrice) * 100),
        reference: item.productId,
        taxCode: 'txcd_30011000',
      })),
      shippingAddress: {
        line1: shippingAddress.address1,
        line2: shippingAddress.address2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      customerEmail: userEmail,
    })

    taxAmount = taxResult.taxAmountDecimal
  } catch (error) {
    console.error('[Orders] Tax calculation failed, proceeding with $0 tax:', error)
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

    const shippingResult = await calculateShipping({
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
  } catch {
    // Continue with 0 shipping rather than blocking checkout
  }

  const total = subtotal + taxAmount + shippingCost

  const shippingSummary = [
    `${shippingAddress.address1}${shippingAddress.address2 ? `, ${shippingAddress.address2}` : ''}`,
    `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postalCode}`,
  ].join('\n')

  void billingAddress // billingAddress accepted but stored via shippingMethod summary for now

  const orderNumber = generateOrderNumber()

  // Create Stripe PaymentIntent before persisting order
  const stripe = getStripe()
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: 'usd',
    receipt_email: userEmail,
    metadata: {
      orderNumber,
      customerName: userName,
    },
    shipping: {
      name: userName,
      address: {
        line1: shippingAddress.address1,
        line2: shippingAddress.address2 ?? undefined,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postal_code: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
    },
  })

  const order = await db.order.create({
    data: {
      orderNumber,
      userId,
      shippingMethod: shippingSummary,
      customerNotes: notes ?? undefined,
      subtotal: toDecimal(subtotal),
      shippingCost: toDecimal(shippingCost),
      tax: toDecimal(taxAmount),
      discountAmount: toDecimal(0),
      total: toDecimal(total),
      paymentStatus: 'PENDING',
      status: 'PENDING',
      stripePaymentId: paymentIntent.id,
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
      userId,
      action: 'create',
      entityType: 'Order',
      entityId: order.id,
      changes: {
        orderNumber: order.orderNumber,
        total: Number(order.total),
        items: orderItems.length,
        customer: userEmail,
      },
    },
    req,
  )

  // Clear cart items after order creation
  await db.cartItem.deleteMany({
    where: {
      id: { in: cartItemIds },
      userId,
    },
  })

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: total,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Order creation failed:', message)
    return NextResponse.json(
      { success: false, error: 'Unable to create order. Please try again.' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`orders:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(req.url)
  const rawParams = {
    status: searchParams.get('status') ?? undefined,
    paymentStatus: searchParams.get('paymentStatus') ?? undefined,
    take: searchParams.get('take') ?? undefined,
    skip: searchParams.get('skip') ?? undefined,
    sortOrder: searchParams.get('sortOrder') ?? undefined,
  }

  const parsed = OrderQuerySchema.safeParse(rawParams)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid query parameters' },
      { status: 422 },
    )
  }

  const { status, paymentStatus, take, skip, sortOrder } = parsed.data
  const userId = session.user.id

  try {
    const where: {
      userId: string
      status?: import('@prisma/client').OrderStatus
      paymentStatus?: import('@prisma/client').PaymentStatus
    } = {
      userId,
    }

    if (status) {
      where.status = status
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }

    const orders = await db.order.findMany({
      where,
      orderBy: {
        createdAt: sortOrder,
      },
      skip,
      take,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    const parsedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: parseFloat(String(order.subtotal)),
      shippingCost: parseFloat(String(order.shippingCost)),
      tax: parseFloat(String(order.tax)),
      discountAmount: parseFloat(String(order.discountAmount)),
      total: parseFloat(String(order.total)),
      shippingMethod: order.shippingMethod,
      trackingNumber: order.trackingNumber,
      customerNotes: order.customerNotes,
      stripePaymentId: order.stripePaymentId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productImage: item.productImage,
        quantity: item.quantity,
        unitPrice: parseFloat(String(item.unitPrice)),
        totalPrice: parseFloat(String(item.totalPrice)),
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              slug: item.product.slug,
              featuredImage: item.product.featuredImage,
              heatLevel: item.product.heatLevel,
            }
          : null,
      })),
    }))

    return NextResponse.json(parsedOrders)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to fetch orders:', message)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 },
    )
  }
}
