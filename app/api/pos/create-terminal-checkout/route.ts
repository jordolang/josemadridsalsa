import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SquareClient, SquareEnvironment } from 'square'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requirePermission } from '@/lib/rbac'
import { reserveMultipleProducts, releaseInventory } from '@/lib/inventory-manager'

const TerminalCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        sku: z.string().optional(),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'Cart is empty'),
  total: z.number().int().positive(),
  taxAmount: z.number().int().min(0).optional().default(0),
  deviceId: z.string().optional().default('default'),
})

const toDecimal = (value: number) =>
  new Prisma.Decimal(value.toFixed(2))

const generateOrderNumber = () => {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(Math.random() * 9000 + 1000)
  return `POS-${datePart}-${randomPart}`
}

function getSquareClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('Square credentials not configured. Set SQUARE_ACCESS_TOKEN.')
  }

  return new SquareClient({
    token: accessToken,
    environment: process.env.SQUARE_SANDBOX !== 'false'
      ? SquareEnvironment.Sandbox
      : SquareEnvironment.Production,
  })
}

export async function POST(request: NextRequest) {
  try {
    // POS requires admin/staff access
    await requirePermission('orders:create')

    const json = await request.json()
    const parsed = TerminalCheckoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, total, taxAmount, deviceId } = parsed.data

    // Resolve actual device ID from environment if 'default'
    const resolvedDeviceId = deviceId === 'default'
      ? process.env.SQUARE_TERMINAL_DEVICE_ID || ''
      : deviceId

    if (!resolvedDeviceId) {
      return NextResponse.json(
        { error: 'No Square Terminal device configured. Set SQUARE_TERMINAL_DEVICE_ID.' },
        { status: 503 }
      )
    }

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const taxDollars = taxAmount / 100
    const totalDollars = total / 100

    // Build order items for DB
    const orderItems = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: toDecimal(item.price),
      totalPrice: toDecimal(item.price * item.quantity),
      productName: item.name,
      productSku: item.sku ?? '',
    }))

    // Reserve inventory
    try {
      await reserveMultipleProducts(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: 'POS terminal checkout reservation',
        }))
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to reserve inventory'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Create DB order, then Square Terminal checkout. Release inventory on failure.
    try {
      const orderNumber = generateOrderNumber()

      const order = await prisma.order.create({
        data: {
          orderNumber,
          subtotal: toDecimal(subtotal),
          shippingCost: toDecimal(0),
          tax: toDecimal(taxDollars),
          discountAmount: toDecimal(0),
          total: toDecimal(totalDollars),
          paymentStatus: 'PENDING',
          status: 'PENDING',
          paymentProvider: 'SQUARE',
          paymentChannel: 'POS',
          shippingMethod: 'IN_STORE_PICKUP',
          items: {
            create: orderItems,
          },
        },
      })

      // Create Square Terminal Checkout
      const client = getSquareClient()
      const response = await client.terminal.checkouts.create({
        idempotencyKey: randomUUID(),
        checkout: {
          amountMoney: {
            amount: BigInt(total),
            currency: 'USD',
          },
          referenceId: order.id,
          note: `Order ${orderNumber}`,
          deviceOptions: {
            deviceId: resolvedDeviceId,
          },
        },
      })

      const terminalCheckout = response.checkout
      if (!terminalCheckout?.id) {
        throw new Error('Square Terminal did not return a checkout ID')
      }

      // Store the terminal checkout ID on the order
      await prisma.order.update({
        where: { id: order.id },
        data: {
          providerPaymentId: terminalCheckout.id,
        },
      })

      return NextResponse.json({
        checkoutId: terminalCheckout.id,
        orderNumber,
      })
    } catch (postReservationError) {
      // Release inventory on failure
      console.error('[POS] Terminal checkout creation failed, releasing inventory:', postReservationError)
      for (const item of items) {
        try {
          await releaseInventory({
            productId: item.productId,
            quantity: item.quantity,
            notes: 'POS terminal checkout failed - releasing reservation',
          })
        } catch (releaseError) {
          console.error('[POS] Failed to release reservation:', releaseError)
        }
      }
      throw postReservationError
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[POS] Create terminal checkout error:', error)
    return NextResponse.json(
      { error: 'Unable to create terminal checkout. Please try again.' },
      { status: 500 }
    )
  }
}
