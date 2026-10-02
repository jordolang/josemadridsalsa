/**
 * Card payments taken on a Square Reader paired with the kiosk iPad (Square's Mobile Payments
 * SDK), as opposed to a Square Terminal.
 *
 * The iPad takes the card and reports the Square payment id. Nothing it reports is trusted:
 * the order is only marked paid after Square itself confirms a completed payment for this
 * order, at this location, for exactly the order total. Order creation, the paid step and
 * cancellation are the same ones the Terminal uses (lib/pos/terminal-checkout).
 */
import type { Square } from 'square'
import prisma from '@/lib/prisma'
import {
  TerminalCheckoutError,
  cancelInPersonOrder,
  createInPersonOrder,
  getSquareClient,
  markInPersonOrderPaid,
  type InPersonOrderInput,
} from '@/lib/pos/terminal-checkout'

export type ReaderStatus = 'COMPLETED' | 'PENDING' | 'CANCELED'

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  userId: true,
  paymentStatus: true,
  paymentChannel: true,
  total: true,
  createdAt: true,
  items: { select: { productId: true, quantity: true } },
} as const

type ReaderOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>

function loadOrder(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, select: ORDER_SELECT })
}

const isPaid = (status: string) => status === 'PAID' || status === 'SUCCEEDED'

/** Order totals are Decimals in dollars; Square amounts are cents. */
export function totalCents(total: { toString(): string }): number {
  return Math.round(Number(total.toString()) * 100)
}

/**
 * Why `payment` does not pay `order`, or null when it does. Every field the iPad could
 * misreport is checked against what Square says.
 */
export function readerPaymentProblem(
  payment: Pick<Square.Payment, 'status' | 'referenceId' | 'locationId' | 'amountMoney'> | undefined,
  order: { id: string; total: { toString(): string } },
  locationId: string | undefined
): string | null {
  if (!payment) return 'Square has no record of that payment'
  if (payment.status !== 'COMPLETED') return `The payment is ${payment.status?.toLowerCase() ?? 'not complete'}`
  if (payment.referenceId !== order.id) return 'That payment belongs to a different order'
  if (!locationId || payment.locationId !== locationId) return 'That payment was taken at a different Square location'
  if (payment.amountMoney?.currency !== 'USD') return 'That payment is not in US dollars'
  if (Number(payment.amountMoney?.amount ?? -1) !== totalCents(order.total)) {
    return 'The amount paid does not match the order total'
  }
  return null
}

/**
 * Hold the stock and record the order; the iPad then takes the card. A retry carrying the
 * same attempt id lands on the same order rather than creating a second one.
 */
export async function createReaderOrder(input: Omit<InPersonOrderInput, 'reservationNote'>) {
  const existing = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
    select: { id: true, paymentStatus: true },
  })
  if (existing) {
    if (existing.paymentStatus === 'PENDING' || isPaid(existing.paymentStatus)) {
      return { orderId: existing.id, alreadyPaid: isPaid(existing.paymentStatus) }
    }
    // A failed or canceled attempt keeps its order number; the caller starts a new attempt.
    throw new TerminalCheckoutError('That payment attempt was closed. Please start again.', 409)
  }

  const { orderId } = await createInPersonOrder({
    ...input,
    reservationNote: `${input.orderPrefix} card reader reservation`,
  })
  return { orderId, alreadyPaid: false }
}

/**
 * The completed Square payment for this order, if there is one. Used when the iPad lost the
 * payment id (or never got it) — the payment carries the order id as its reference.
 */
async function findOrderPayment(order: ReaderOrder): Promise<Square.Payment | undefined> {
  const locationId = process.env.SQUARE_LOCATION_ID
  // A little before the order was created, in case the clocks disagree.
  const beginTime = new Date(order.createdAt.getTime() - 5 * 60_000).toISOString()
  const page = await getSquareClient().payments.list({ beginTime, locationId, sortOrder: 'ASC' })
  for await (const payment of page) {
    if (payment.referenceId === order.id && payment.status === 'COMPLETED') return payment
  }
  return undefined
}

/**
 * Settle the order from Square's own record of the payment. `paymentId` is what the iPad
 * reported; without it, Square is searched for a completed payment carrying this order.
 */
export async function confirmReaderPayment(orderId: string, paymentId?: string) {
  const order = await loadOrder(orderId)
  if (!order || order.paymentChannel !== 'POS') throw new TerminalCheckoutError('Order not found', 404)
  if (isPaid(order.paymentStatus)) return { status: 'COMPLETED' as ReaderStatus, orderNumber: order.orderNumber }
  if (order.paymentStatus !== 'PENDING') {
    throw new TerminalCheckoutError('This order was canceled before the payment was confirmed. Check the Square dashboard.', 409)
  }

  const payment = paymentId
    ? (await getSquareClient().payments.get({ paymentId }).catch(() => undefined))?.payment
    : await findOrderPayment(order)

  if (!payment && !paymentId) return { status: 'PENDING' as ReaderStatus, orderNumber: order.orderNumber }

  const problem = readerPaymentProblem(payment, order, process.env.SQUARE_LOCATION_ID)
  if (problem) throw new TerminalCheckoutError(problem, 409)

  const used = await prisma.payment.findUnique({ where: { squarePaymentId: payment!.id }, select: { orderId: true } })
  if (used && used.orderId !== order.id) throw new TerminalCheckoutError('That payment was already used for another order', 409)

  await markInPersonOrderPaid(order, {
    squarePaymentId: payment!.id!,
    amountInCents: totalCents(order.total),
    methodType: 'SQUARE_READER',
  })
  return { status: 'COMPLETED' as ReaderStatus, orderNumber: order.orderNumber }
}

/**
 * The customer backed out or the card was declined. Square is asked first: a payment that
 * went through after all settles the order instead of canceling it.
 */
export async function cancelReaderOrder(orderId: string) {
  const order = await loadOrder(orderId)
  if (!order || order.paymentChannel !== 'POS') throw new TerminalCheckoutError('Order not found', 404)
  if (isPaid(order.paymentStatus)) return { status: 'COMPLETED' as ReaderStatus, orderNumber: order.orderNumber }

  if (order.paymentStatus === 'PENDING') {
    const paid = await findOrderPayment(order)
    if (paid?.id) return confirmReaderPayment(order.id, paid.id)
    await cancelInPersonOrder(order, `Card reader payment canceled for order ${order.id}`)
  }
  return { status: 'CANCELED' as ReaderStatus, orderNumber: order.orderNumber }
}
