import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getProvider, getProviderForMethod } from '@/lib/payments'
import { getCurrentUser } from '@/lib/rbac'
import type { PaymentProvider, PaymentMethodType } from '@/lib/payments/types'

const CreatePaymentSchema = z.object({
  orderId: z.string().cuid(),
  provider: z.enum(['STRIPE', 'SQUARE', 'PAYPAL']).optional(),
  methodType: z
    .enum(['CARD', 'ACH', 'APPLE_PAY', 'GOOGLE_PAY', 'PAYPAL', 'SQUARE_TERMINAL'])
    .optional(),
  channel: z.enum(['ONLINE', 'POS']).optional().default('ONLINE'),
  guestEmail: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await request.json()
    const { orderId, provider, methodType, channel, guestEmail } = CreatePaymentSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        guestEmail: true,
        total: true,
        paymentStatus: true,
        shippingAddress: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify ownership: authenticated users must own the order,
    // guests must provide matching email
    if (order.userId) {
      if (!user || user.id !== order.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Guest order: require matching email
      if (!guestEmail || guestEmail.toLowerCase() !== order.guestEmail?.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (order.paymentStatus === 'SUCCEEDED' || order.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Order has already been paid' },
        { status: 400 }
      )
    }

    // Resolve the adapter: explicit provider > method-based routing > default STRIPE
    let adapter
    if (provider) {
      adapter = getProvider(provider as PaymentProvider)
    } else if (methodType) {
      adapter = getProviderForMethod(methodType as PaymentMethodType)
    } else {
      adapter = getProvider('STRIPE')
    }

    // Resolve provider customer ID for authenticated users.
    // Each provider has its own customer model; only Stripe currently
    // persists customer IDs on the User record. PayPal handles identity
    // via its redirect flow, and Square uses its own customer directory.
    let providerCustomerId: string | undefined
    if (user && adapter.provider === 'STRIPE') {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
      })

      if (dbUser?.stripeCustomerId) {
        providerCustomerId = dbUser.stripeCustomerId
      } else {
        const customerResult = await adapter.createCustomer(
          user.email,
          user.name || user.email,
          { userId: user.id }
        )
        providerCustomerId = customerResult.providerId

        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerResult.providerId },
        })
      }
    }

    const amountInCents = Math.round(Number(order.total) * 100)
    const customerEmail = user?.email || order.guestEmail || ''

    const paymentResult = await adapter.createPayment({
      amount: amountInCents,
      currency: 'usd',
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail,
      customerName: user?.name || customerEmail,
      shippingAddress: order.shippingAddress
        ? {
            line1: order.shippingAddress.street,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            postalCode: order.shippingAddress.zipCode,
            country: order.shippingAddress.country || 'US',
          }
        : undefined,
      customerId: providerCustomerId,
      setupFutureUsage: !!providerCustomerId,
      channel: channel as 'ONLINE' | 'POS',
      methodType: methodType as PaymentMethodType | undefined,
    })

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || 'Payment creation failed' },
        { status: 500 }
      )
    }

    // Update order with provider info
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentProvider: adapter.provider,
        paymentChannel: channel as 'ONLINE' | 'POS',
        providerPaymentId: paymentResult.providerPaymentId,
        paymentStatus: 'PENDING',
      },
    })

    return NextResponse.json({
      success: true,
      provider: adapter.provider,
      providerPaymentId: paymentResult.providerPaymentId,
      clientSecret: paymentResult.clientSecret,
      approvalUrl: paymentResult.approvalUrl,
      status: paymentResult.status,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Unified payment creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}
