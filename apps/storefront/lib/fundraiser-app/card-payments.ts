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

type CardOrder = NonNullable<Awaited<ReturnType<typeof loadCardOrder>>>

const isPaid = (status: string) => status === 'PAID' || status === 'SUCCEEDED'

/** Fundraiser-app card orders are numbered `APP-…`; the Square webhook routes them here by this. */
export function isFundraiserAppCardOrder(order: { orderNumber: string; paymentProvider: string | null }) {
  return order.orderNumber.startsWith('APP-') && order.paymentProvider === 'SQUARE'
}

/** Checking a payment needs the storefront's own Square credentials (the same ones the kiosk uses). */
function requireSquareApi() {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    throw new FundraiserAppError('Card payments are not set up yet. Ask Jose Madrid Salsa.', 503)
  }
}

/** A Square payment as both the Payments API and the webhook describe it. */
export type SquareCardPayment = Parameters<typeof readerPaymentProblem>[0] & { id?: string }

/**
 * Mark a card order paid from a Square payment, after checking that payment really pays it. The
 * one place a fundraiser-app card order becomes paid: the phone's confirmation, a cancel that finds
 * the card went through after all, and the Square webhook all come here.
 *
 * An order the app canceled (`FAILED`) can still be settled: if Square shows a completed payment
 * for it, the customer was charged and the sale is recorded rather than stranded.
 */
async function settleCardOrder(order: CardOrder, payment: SquareCardPayment): Promise<CardStatus> {
  const problem = readerPaymentProblem(payment, order, process.env.SQUARE_LOCATION_ID)
  if (problem) throw new FundraiserAppError(problem, 409)

  const squarePaymentId = payment.id!
  const used = await prisma.payment.findUnique({ where: { squarePaymentId }, select: { orderId: true } })
  if (used && used.orderId !== order.id) throw new FundraiserAppError('That payment was already used for another order', 409)

  const amount = totalCents(order.total)
  const settled = await prisma.$transaction(async (tx) => {
    // The claim: confirmations racing each other (a retry, the webhook) settle the order once.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: { in: ['PENDING', 'FAILED'] } },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
    })
    if (claimed.count === 0) return false

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
    return true
  })
  if (settled) return 'COMPLETED'

  // Lost the claim: whoever won decides the answer.
  const now = await prisma.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true } })
  if (now && isPaid(now.paymentStatus)) return 'COMPLETED'
  throw new FundraiserAppError('This order can no longer take a card payment. Check it in the Square dashboard.', 409)
}

/**
 * Settle a card order from Square's own record. `paymentId` is what the phone reported; without
 * it, Square is searched for a completed payment carrying this order (the phone lost the answer).
 */
export async function confirmCardPayment(session: AppSession, orderId: string, paymentId?: string) {
  const order = await loadCardOrder(session, orderId)
  if (isPaid(order.paymentStatus)) return { status: 'COMPLETED' as CardStatus, orderNumber: order.orderNumber }
  if (order.paymentStatus !== 'PENDING' && order.paymentStatus !== 'FAILED') {
    throw new FundraiserAppError('This order can no longer take a card payment. Check it in the Square dashboard.', 409)
  }

  requireSquareApi()
  const payment = paymentId
    ? (await getSquareClient().payments.get({ paymentId }).catch(() => undefined))?.payment
    : await findOrderPayment(order)
  if (!payment && !paymentId) {
    if (order.paymentStatus === 'FAILED') {
      throw new FundraiserAppError('This card order was canceled. Take the order again.', 409)
    }
    return { status: 'PENDING' as CardStatus, orderNumber: order.orderNumber }
  }
  if (!payment) throw new FundraiserAppError('Square has no record of that payment', 409)

  return { status: await settleCardOrder(order, payment), orderNumber: order.orderNumber }
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
    const canceled = await prisma.order.updateMany({
      where: { id: order.id, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    })
    if (canceled.count === 0) {
      // A confirmation got there first.
      const now = await prisma.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true } })
      if (now && isPaid(now.paymentStatus)) return { status: 'COMPLETED' as CardStatus, orderNumber: order.orderNumber }
    }
  }
  return { status: 'CANCELED' as CardStatus, orderNumber: order.orderNumber }
}

/**
 * The Square webhook's path for fundraiser-app card orders: the same checks and the same settle
 * step as the phone's confirmation, so a payment that does not pay the order (wrong amount, wrong
 * location) never marks it paid, whichever arrives first.
 */
export async function settleFundraiserAppPaymentFromWebhook(orderId: string, payment: SquareCardPayment) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: orderSelect })
  if (!order || !isFundraiserAppCardOrder(order)) return { handled: false as const }
  if (isPaid(order.paymentStatus)) return { handled: true as const, status: 'COMPLETED' as CardStatus }
  try {
    return { handled: true as const, status: await settleCardOrder(order, payment) }
  } catch (error) {
    if (error instanceof FundraiserAppError) return { handled: true as const, problem: error.message }
    throw error
  }
}
