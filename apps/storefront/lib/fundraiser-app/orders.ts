/**
 * Orders a seller takes in the mobile fundraiser app — over the phone, at the door, from family.
 *
 * The app sends products and quantities, never prices. Each line is priced from the group's own
 * fundraiser store (`lib/fundraising/store.server.ts`), exactly as the campaign web page prices
 * it, and the order is recorded against the group and the seller like any other fundraiser sale.
 *
 * The seller collects the money, so there is no processor and no `Payment` row (see
 * `lib/admin/manual-order.ts` for why). Cash or a check in hand is a paid order and is credited
 * to the group straight away, the same as an admin marking an order paid. "Pay later" is left
 * pending until Jose Madrid marks it paid, which credits it then. A card order is pending until
 * Square confirms the card the phone took (`card-payments.ts`). Stock is not reserved here:
 * fundraiser orders are packed in bulk when the campaign closes. Salsa is grocery food, which
 * Ohio does not tax, and the seller delivers, so there is no tax or shipping either.
 */
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { creditFundraiserCommission } from '@/lib/fundraising/credit-commission'
import {
  FundraiserStoreUnavailableError,
  loadFundraiserStoreProducts,
  priceInStore,
  resolveFundraiserStore,
} from '@/lib/fundraising/store.server'
import { emitOrderCreated } from '@/lib/orders/events'
import { deriveSalesChannel } from '@/lib/orders/sales-channel'
import { inPersonOrderNumber } from '@/lib/pos/terminal-checkout'
import type { AppSession } from './access'
import { requireCardPayments } from './card-payments'
import { FundraiserAppError } from './errors'

export const PAYMENT_METHODS = {
  CASH: 'Cash (collected by seller)',
  CHECK: 'Check (collected by seller)',
  PAY_LATER: 'Pay on delivery',
  CARD: 'Card (Square)',
} as const

const MAX_JARS = 500

export const PhoneOrderSchema = z
  .object({
    /** Made by the app once per order and reused on retries, so a lost response cannot double it. */
    clientOrderId: z.string().uuid(),
    /**
     * Who bought it. Optional for a sale paid on the spot (the register's tap-to-pay or cash sale to
     * whoever is standing there); required when the seller has to come back to them — pay later, or
     * a delivery.
     */
    customer: z.object({
      firstName: z.string().trim().min(1, "Enter the customer's first name").max(50),
      lastName: z.string().trim().min(1, "Enter the customer's last name").max(50),
      phone: z.string().trim().min(7, "Enter the customer's phone number").max(40),
      email: z.string().trim().toLowerCase().email('That email does not look right').optional().or(z.literal('')),
    }).optional(),
    /** Where the seller will drop the order off. Optional: many are handed over in person. */
    address: z
      .object({
        street: z.string().trim().min(1).max(200),
        city: z.string().trim().min(1).max(100),
        state: z.string().trim().min(2).max(50),
        zipCode: z.string().trim().min(3).max(20),
      })
      .optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(64),
          quantity: z.number().int().min(1).max(MAX_JARS),
        })
      )
      .min(1, 'Add at least one salsa')
      .max(100),
    /** CARD: the phone takes the card next, with Square (see `card-payments.ts`). */
    payment: z.enum(['CASH', 'CHECK', 'PAY_LATER', 'CARD']),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((order, ctx) => {
    if (!order.customer && (order.payment === 'PAY_LATER' || order.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['customer'],
        message: "Add the customer's name and phone so you can collect or deliver later",
      })
    }
  })

export type PhoneOrderInput = z.infer<typeof PhoneOrderSchema>

async function storeFor(session: AppSession) {
  try {
    const store = await resolveFundraiserStore({ fundraiserSlug: session.participant.fundraiser.slug })
    if (!store) {
      throw new FundraiserAppError('Your fundraiser store is not open for orders yet.', 409)
    }
    return store
  } catch (error) {
    if (error instanceof FundraiserStoreUnavailableError) {
      throw new FundraiserAppError(error.message, 503)
    }
    throw error
  }
}

/** The salsas this group sells, at its prices. */
export async function loadAppCatalog(session: AppSession) {
  const store = await storeFor(session)
  const products = await loadFundraiserStoreProducts(store)
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    imageUrl: product.featuredImage,
    heatLevel: product.heatLevel,
  }))
}

const round2 = (value: number) => Math.round(value * 100) / 100
const money = (value: number) => new Prisma.Decimal(value.toFixed(2))

export async function createPhoneOrder(session: AppSession, input: PhoneOrderInput) {
  const seller = session.participant
  const orderNumber = inPersonOrderNumber('APP', input.clientOrderId)

  // A retry of an order that already went through gets the same order back.
  const previous = await findRetriedOrder(orderNumber, seller.id)
  if (previous) return previous

  if (input.payment === 'CARD') requireCardPayments(session)
  const store = await storeFor(session)

  const quantities = new Map<string, number>()
  for (const line of input.items) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
  }
  const jars = [...quantities.values()].reduce((sum, q) => sum + q, 0)
  if (jars > MAX_JARS) {
    throw new FundraiserAppError(`One order can hold up to ${MAX_JARS} jars.`, 400)
  }

  const { prices, unavailable } = priceInStore(store, [...quantities.keys()])
  const products = await prisma.product.findMany({
    where: { id: { in: [...prices.keys()] }, isActive: true },
    select: { id: true, name: true, sku: true, costPrice: true, featuredImage: true },
  })
  if (unavailable.length > 0 || products.length !== prices.size) {
    throw new FundraiserAppError(
      'Something in this order is no longer sold by your fundraiser. Refresh the menu and try again.',
      409
    )
  }

  const lines = products.map((product) => {
    const quantity = quantities.get(product.id) as number
    const unitPrice = prices.get(product.id) as number
    return {
      productId: product.id,
      quantity,
      unitPrice: money(unitPrice),
      totalPrice: money(round2(unitPrice * quantity)),
      unitCost: product.costPrice,
      productName: product.name,
      productSku: product.sku,
      productImage: product.featuredImage ?? undefined,
    }
  })
  const subtotal = round2(lines.reduce((sum, line) => sum + Number(line.totalPrice), 0))

  const card = input.payment === 'CARD'
  const paid = input.payment === 'CASH' || input.payment === 'CHECK'
  const customer = input.customer
  const customerName = customer ? `${customer.firstName} ${customer.lastName}` : null
  const salesChannel = deriveSalesChannel({ fundraiserId: store.fundraiserId, participantId: seller.id })

  let order
  try {
    order = await prisma.$transaction(async (tx) => {
    const address = input.address && customer
      ? await tx.address.create({
          data: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            ...input.address,
          },
          select: { id: true },
        })
      : null

    const created = await tx.order.create({
      data: {
        orderNumber,
        guestEmail: customer?.email || null,
        guestPhone: customer?.phone ?? null,
        shippingAddressId: address?.id,
        subtotal: money(subtotal),
        total: money(subtotal),
        status: paid ? 'CONFIRMED' : 'PENDING',
        paymentStatus: paid ? 'PAID' : 'PENDING',
        paymentMethod: PAYMENT_METHODS[input.payment],
        // Cash, check and pay-later have no processor; the column defaults would otherwise call
        // them Stripe sales. A card is an in-person Square payment.
        paymentChannel: card ? 'POS' : null,
        paymentProvider: card ? 'SQUARE' : null,
        salesChannel,
        shippingMethod: 'Delivered by seller',
        fundraiserId: store.fundraiserId,
        participantId: seller.id,
        sellerName: seller.name,
        customerNotes: input.notes || null,
        adminNotes: customerName
          ? `Phone order taken in the fundraiser app by ${seller.name} for ${customerName}.`
          : `Walk-up sale taken in the fundraiser app by ${seller.name}.`,
        items: { create: lines },
      },
      select: orderSummarySelect,
    })

    if (paid) {
      await creditFundraiserCommission(tx, created.id)
      // A collected sale is a completed payment like the POS cash path's: the confirmation email,
      // ledger, notifications and milestone emails all hang off this event.
      await emitDomainEvent(
        {
          type: 'payment.completed',
          entityType: 'order',
          entityId: created.id,
          payload: {
            provider: input.payment,
            channel: 'FUNDRAISER_APP',
            amount: Math.round(subtotal * 100),
            currency: 'usd',
          },
        },
        tx
      )
    }
    return created
  })
  } catch (error) {
    // Two overlapping retries of one order: the unique order number let only one in.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await findRetriedOrder(orderNumber, seller.id)
      if (winner) return winner
    }
    throw error
  }

  await emitOrderCreated({
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    itemCount: lines.length,
    salesChannel,
  })

  return { ...summarize(order), duplicate: false }
}

/** The order a retry carrying this order number already created, if this seller made it. */
async function findRetriedOrder(orderNumber: string, sellerId: string) {
  const previous = await prisma.order.findUnique({ where: { orderNumber }, select: orderSummarySelect })
  if (!previous) return null
  if (previous.participantId !== sellerId) {
    throw new FundraiserAppError('That order could not be saved. Please try again.', 409)
  }
  return { ...summarize(previous), duplicate: true }
}

const orderSummarySelect = {
  id: true,
  orderNumber: true,
  total: true,
  participantId: true,
  paymentStatus: true,
  paymentProvider: true,
} as const

function summarize(order: {
  id: string
  orderNumber: string
  total: unknown
  paymentStatus: string
  paymentProvider: string | null
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    /** What the phone charges, in cents, when the order is waiting on a card. */
    amountCents: Math.round(Number(order.total) * 100),
    paid: order.paymentStatus === 'PAID',
    awaitingCard: order.paymentProvider === 'SQUARE' && order.paymentStatus === 'PENDING',
  }
}

/** The seller's own orders, newest first. */
export async function listSellerOrders(session: AppSession) {
  const orders = await prisma.order.findMany({
    where: { participantId: session.participant.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentProvider: true,
      paymentMethod: true,
      total: true,
      guestPhone: true,
      adminNotes: true,
      shippingAddress: { select: { firstName: true, lastName: true } },
      items: { select: { productName: true, quantity: true } },
    },
  })

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    paid: order.paymentStatus === 'PAID',
    // A card order whose payment the app never confirmed (closed mid-sale, lost connection). The
    // order list offers to finish or cancel it, so it can be recovered after a restart.
    awaitingCard: order.paymentProvider === 'SQUARE' && order.paymentStatus === 'PENDING',
    amountCents: Math.round(Number(order.total) * 100),
    paymentMethod: order.paymentMethod,
    total: Number(order.total),
    customerName: order.shippingAddress
      ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
      : customerFromNote(order.adminNotes),
    customerPhone: order.guestPhone,
    items: order.items,
  }))
}

/** Orders without an address keep the customer's name only in the note this module writes. */
function customerFromNote(note: string | null): string | null {
  return note?.match(/ for (.+)\.$/)?.[1] ?? null
}
