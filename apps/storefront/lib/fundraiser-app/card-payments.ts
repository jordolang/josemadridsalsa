/**
 * Card payments in the fundraiser app, taken on the seller's phone with Square's Mobile Payments
 * SDK: Tap to Pay on iPhone or Android, a keyed-in card for an order taken over the phone, or a
 * paired Square Reader. The money lands in Jose Madrid's Square account, at SQUARE_LOCATION_ID.
 *
 * The order is recorded first (pending), then the phone takes the card with the order id as the
 * payment's reference. Nothing the phone reports is trusted: the order is marked paid only after
 * Square itself confirms a completed payment for this order, at this location, for exactly the
 * order total (`readerPaymentProblem`, shared with the kiosk). Paying credits the group like any
 * other paid fundraiser order and emits `payment.completed`, so the customer's confirmation email
 * and the seller's milestone emails follow.
 *
 * A group only gets this when an admin turns on `Fundraiser.appCardPayments`, because a phone
 * that takes cards holds a Square access token for the shop's account.
 */
import prisma from '@/lib/prisma'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { creditFundraiserCommission } from '@/lib/fundraising/credit-commission'
import { findOrderPayment, readerPaymentProblem, totalCents } from '@/lib/pos/reader-checkout'
import { getSquareClient } from '@/lib/pos/terminal-checkout'
import { SquareOAuthError, getSquareReaderToken } from '@/lib/square/oauth'
import type { AppSession } from './access'
import { FundraiserAppError } from './errors'

export type CardStatus = 'COMPLETED' | 'PENDING' | 'CANCELED'

export function requireCardPayments(session: AppSession) {
  if (!session.participant.fundraiser.appCardPayments) {
    throw new FundraiserAppError('Card payments are not turned on for your group.', 403)
  }
}

/**
 * The Square sign-in for the phone's payment SDK: an OAuth access token for the shop's account and
 * the location to take payments at. Only an unlocked seller in a group with card payments on.
 */
export async function squareAuthorizationFor(session: AppSession) {
  requireCardPayments(session)
  const locationId = process.env.SQUARE_LOCATION_ID
  if (!locationId) throw new FundraiserAppError('Card payments are not set up yet. Ask Jose Madrid Salsa.', 503)
  try {
    const { accessToken, expiresAt } = await getSquareReaderToken()
    return { accessToken, expiresAt, locationId }
  } catch (error) {
    if (error instanceof SquareOAuthError) {
      throw new FundraiserAppError('Card payments are not connected to Square yet. Ask Jose Madrid Salsa.', 503)
    }
    throw error
  }
}

const orderSelect = {
  id: true,
  orderNumber: true,
  participantId: true,
  paymentStatus: true,
  paymentProvider: true,
  total: true,
  createdAt: true,
} as const

async function loadCardOrder(session: AppSession, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: orderSelect })
  // Another seller's order, or one not waiting on a card, is not this seller's to settle.
  if (!order || order.participantId !== session.participant.id || order.paymentProvider !== 'SQUARE') {
    throw new FundraiserAppError('Order not found', 404)
  }
  return order
}

const isPaid = (status: string) => status === 'PAID' || status === 'SUCCEEDED'

/** Checking a payment needs the storefront's own Square credentials (the same ones the kiosk uses). */
function requireSquareApi() {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    throw new FundraiserAppError('Card payments are not set up yet. Ask Jose Madrid Salsa.', 503)
  }
}

/**
 * Settle a card order from Square's own record. `paymentId` is what the phone reported; without
 * it, Square is searched for a completed payment carrying this order (the phone lost the answer).
 */
export async function confirmCardPayment(session: AppSession, orderId: string, paymentId?: string) {
  const order = await loadCardOrder(session, orderId)
  if (isPaid(order.paymentStatus)) return { status: 'COMPLETED' as CardStatus, orderNumber: order.orderNumber }
  if (order.paymentStatus !== 'PENDING') {
    throw new FundraiserAppError('This order was canceled before the card was confirmed. Take the order again.', 409)
  }

  requireSquareApi()
  const locationId = process.env.SQUARE_LOCATION_ID
  const payment = paymentId
    ? (await getSquareClient().payments.get({ paymentId }).catch(() => undefined))?.payment
    : await findOrderPayment(order)
  if (!payment && !paymentId) return { status: 'PENDING' as CardStatus, orderNumber: order.orderNumber }

  const problem = readerPaymentProblem(payment, order, locationId)
  if (problem) throw new FundraiserAppError(problem, 409)

  const squarePaymentId = payment!.id!
  const used = await prisma.payment.findUnique({ where: { squarePaymentId }, select: { orderId: true } })
  if (used && used.orderId !== order.id) throw new FundraiserAppError('That payment was already used for another order', 409)

  const amount = totalCents(order.total)
  await prisma.$transaction(async (tx) => {
    // The claim: two confirmations racing (a retry, a lost response) settle the order once.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
    })
    if (claimed.count === 0) return

    await tx.payment.create({
      data: {
        squarePaymentId,
        orderId: order.id,
        amount,
        currency: 'usd',
        status: 'SUCCEEDED',
        provider: 'SQUARE',
        providerPaymentId: squarePaymentId,
        channel: 'POS',
        methodType: 'SQUARE_MOBILE_PAYMENTS',
        paidAt: new Date(),
      },
    })
    await creditFundraiserCommission(tx, order.id)
    await emitDomainEvent(
      {
        type: 'payment.completed',
        entityType: 'order',
        entityId: order.id,
        payload: { provider: 'SQUARE', channel: 'POS', amount, currency: 'usd', squarePaymentId },
      },
      tx
    )
  })

  return { status: 'COMPLETED' as CardStatus, orderNumber: order.orderNumber }
}

/**
 * The card was declined or the customer backed out. Square is asked first: a payment that went
 * through after all settles the order instead of canceling it.
 */
export async function cancelCardOrder(session: AppSession, orderId: string) {
  const order = await loadCardOrder(session, orderId)
  if (isPaid(order.paymentStatus)) return { status: 'COMPLETED' as CardStatus, orderNumber: order.orderNumber }

  if (order.paymentStatus === 'PENDING') {
    requireSquareApi()
    const paid = await findOrderPayment(order)
    if (paid?.id) return confirmCardPayment(session, order.id, paid.id)
    await prisma.order.updateMany({
      where: { id: order.id, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    })
  }
  return { status: 'CANCELED' as CardStatus, orderNumber: order.orderNumber }
}
