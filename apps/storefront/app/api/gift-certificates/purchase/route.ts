import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { generateGiftCertificateCode } from '@/lib/utils'
import { emitOrderCreated } from '@/lib/orders/events'

const GiftCertificatePurchaseSchema = z.object({
  purchaserName: z.string().min(1, 'Your name is required'),
  purchaserEmail: z.string().email('Valid email is required'),
  recipientName: z.string().min(1, "Recipient's name is required"),
  recipientEmail: z.string().email("Recipient's email is required"),
  amount: z.number().positive('Amount must be greater than 0').min(1, 'Minimum amount is $1'),
  theme: z.enum(['BIRTHDAY', 'BOY_CELEBRATION', 'CHRISTMAS', 'GENERAL', 'GIRL']),
  message: z.string().optional(),
  nonRefundableAgreement: z.boolean().refine((val) => val === true, {
    message: 'You must agree that gift certificates are nonrefundable',
  }),
})

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(2))

const generateOrderNumber = () => {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(Math.random() * 9000 + 1000)
  return `JMS-GC-${datePart}-${randomPart}`
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = GiftCertificatePurchaseSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid gift certificate purchase data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { purchaserName, purchaserEmail, recipientName, recipientEmail, amount, theme, message } =
      parsed.data

    // Create order for gift certificate
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        guestEmail: purchaserEmail,
        subtotal: toDecimal(amount),
        shippingCost: toDecimal(0),
        tax: toDecimal(0),
        discountAmount: toDecimal(0),
        total: toDecimal(amount),
        paymentStatus: 'PENDING',
        status: 'PENDING',
        customerNotes: `Gift Certificate Purchase - Recipient: ${recipientName}${message ? ` - Message: ${message}` : ''}`,
      },
    })

    await emitOrderCreated({
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      salesChannel: order.salesChannel,
      // A gift certificate has no order items — the certificate itself is the goods.
      itemCount: 0,
    })

    // Generate unique gift certificate code
    let code = generateGiftCertificateCode()
    let codeExists = true
    while (codeExists) {
      const existing = await prisma.giftCertificate.findUnique({
        where: { code },
      })
      if (!existing) {
        codeExists = false
      } else {
        code = generateGiftCertificateCode()
      }
    }

    // Create gift certificate (will be linked to order after payment)
    const giftCertificate = await prisma.giftCertificate.create({
      data: {
        code,
        orderId: order.id,
        originalAmount: toDecimal(amount),
        balance: toDecimal(amount),
        purchaserName,
        purchaserEmail,
        recipientName,
        recipientEmail,
        theme,
        message: message || undefined,
        status: 'ACTIVE',
      },
    })

    // Create Stripe payment intent
    const stripe = getStripe()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      receipt_email: purchaserEmail,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        giftCertificateId: giftCertificate.id,
        giftCertificateCode: code,
        customerName: purchaserName,
        recipientName,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      giftCertificateId: giftCertificate.id,
      giftCertificateCode: code,
      amount,
    })
  } catch (error) {
    console.error('Gift certificate purchase error:', error)
    return NextResponse.json(
      { error: 'Unable to process gift certificate purchase. Please try again.' },
      { status: 500 }
    )
  }
}
