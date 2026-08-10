import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { adjustInventory } from '@/lib/inventory-manager'
import { RefundError, refundPaymentInTx } from '@/lib/payments/refund'
import {
  generateExchangeOrderNumber,
  generateStoreCreditCode,
  returnValueCents,
  storeCreditExpiry,
  type ReturnOutcome,
} from '@/lib/orders/return-resolution'

/**
 * Turn a return's resolution into the thing it promises: money back, credit, or replacement
 * goods.
 *
 * All three settle to the **same value** — `returnValueCents` over the returned lines, less any
 * restocking fee — so which button staff press changes the form the customer's compensation
 * takes, never the amount.
 */

export class ReturnSettlementError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'ReturnSettlementError'
  }
}

export interface ResolutionSettlement {
  outcome: ReturnOutcome
  valueCents: number
  refundId?: string
  giftCertificateId?: string
  exchangeOrderId?: string
  exchangeOrderNumber?: string
  storeCreditCode?: string
}

interface SettleReturnInput {
  outcome: ReturnOutcome
  restockingFeeCents: number
  actorUserId: string
  returnRequest: {
    id: string
    rmaNumber: string
    orderId: string
    order: {
      orderNumber: string
      userId: string | null
      guestEmail: string | null
      shippingAddressId: string | null
      payments: Array<{ id: string }>
      user: { name: string | null; email: string } | null
    }
    items: Array<{
      orderItemId: string
      quantity: number
      orderItem: {
        productId: string
        productName: string
        productSku: string
        unitPrice: Prisma.Decimal
        unitCost: Prisma.Decimal | null
        productImage: string | null
      }
    }>
  }
}

const toCents = (value: Prisma.Decimal) => Math.round(Number(value) * 100)
const toDecimal = (cents: number) => new Prisma.Decimal((cents / 100).toFixed(2))

export async function settleReturn(input: SettleReturnInput): Promise<ResolutionSettlement> {
  const { outcome, returnRequest, restockingFeeCents, actorUserId } = input

  const valueCents = returnValueCents(
    returnRequest.items.map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      unitPriceCents: toCents(item.orderItem.unitPrice),
    })),
    restockingFeeCents
  )

  switch (outcome) {
    case 'REFUND':
      return settleAsRefund(input, valueCents)
    case 'STORE_CREDIT':
      return settleAsStoreCredit(input, valueCents)
    case 'EXCHANGE':
      return settleAsExchange(input, valueCents)
  }
}

/**
 * Refund the value at the processor that took the money.
 *
 * The newest successful payment is used because that is the one with refundable balance on a
 * re-charged order. An order with no successful payment — a manual phone sale awaiting a cheque,
 * or a cash sale — cannot be refunded through a processor at all, and says so rather than
 * recording a refund that never happened.
 */
async function settleAsRefund(
  input: SettleReturnInput,
  valueCents: number
): Promise<ResolutionSettlement> {
  const { returnRequest } = input

  if (valueCents <= 0) {
    throw new ReturnSettlementError(
      'The restocking fee cancels out the refund, so there is nothing to send back. Reduce the fee, or resolve this return as store credit.',
      400
    )
  }

  const payment = returnRequest.order.payments[0]
  if (!payment) {
    throw new ReturnSettlementError(
      `Order ${returnRequest.order.orderNumber} has no processed payment to refund — cash and cheque sales have to be refunded outside the system. Resolve this return as store credit instead, or record the refund manually.`,
      409
    )
  }

  try {
    const refund = await prisma.$transaction((tx) =>
      refundPaymentInTx(tx, {
        paymentId: payment.id,
        amountCents: valueCents,
        reason: `Return ${returnRequest.rmaNumber}`,
      })
    )

    return { outcome: 'REFUND', valueCents, refundId: refund.id }
  } catch (error) {
    if (error instanceof RefundError) {
      // EXCEEDS_REFUNDABLE is the interesting one: it means the order was already refunded
      // elsewhere, and the staff member needs to know that rather than see a generic failure.
      const status = error.code === 'EXCEEDS_REFUNDABLE' ? 409 : 502
      throw new ReturnSettlementError(`Refund failed: ${error.message}`, status)
    }
    throw error
  }
}

/**
 * Issue a gift certificate for the value.
 *
 * `GiftCertificate` was built for purchases, so its purchaser fields have no natural value
 * here — the business is the issuer and the customer is the recipient. Both are filled with
 * that reading rather than left blank, and the code is prefixed `JMS-CR-` so credit is
 * distinguishable from a certificate somebody paid for.
 */
async function settleAsStoreCredit(
  input: SettleReturnInput,
  valueCents: number
): Promise<ResolutionSettlement> {
  const { returnRequest } = input

  if (valueCents <= 0) {
    throw new ReturnSettlementError(
      'The restocking fee cancels out the credit, so there is nothing to issue.',
      400
    )
  }

  const customerEmail = returnRequest.order.user?.email ?? returnRequest.order.guestEmail
  const customerName = returnRequest.order.user?.name ?? 'Customer'
  const now = new Date()

  // Retry on the unique code constraint rather than pre-checking, so two returns completed at
  // the same moment cannot both pass a check and then collide on insert.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateStoreCreditCode(now)
    try {
      const certificate = await prisma.giftCertificate.create({
        data: {
          code,
          originalAmount: toDecimal(valueCents),
          balance: toDecimal(valueCents),
          purchaserName: 'Jose Madrid Salsa',
          purchaserEmail: 'orders@josemadridsalsa.com',
          recipientName: customerName,
          recipientEmail: customerEmail,
          theme: 'GENERAL',
          message: `Store credit for return ${returnRequest.rmaNumber} on order ${returnRequest.order.orderNumber}`,
          status: 'ACTIVE',
          expiresAt: storeCreditExpiry(now),
        },
        select: { id: true, code: true },
      })

      return {
        outcome: 'STORE_CREDIT',
        valueCents,
        giftCertificateId: certificate.id,
        storeCreditCode: certificate.code,
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        attempt < 4
      ) {
        continue
      }
      throw error
    }
  }

  throw new ReturnSettlementError('Could not generate a unique store credit code', 500)
}

/**
 * Raise a replacement order for the returned goods.
 *
 * Zero total, because the customer already paid on the original order — the replacement is a
 * fulfillment obligation, not a sale. `exchangeForReturnId` is what keeps it out of every
 * revenue report; without it the order would read as revenue 0 against a real cost and report
 * a loss on every exchange.
 *
 * Stock comes out as it would for any order: the returned unit going back on the shelf and the
 * replacement coming off it net to zero for a resellable return, and to a genuine loss of one
 * unit when the goods came back damaged. That is the true picture in both cases.
 */
async function settleAsExchange(
  input: SettleReturnInput,
  valueCents: number
): Promise<ResolutionSettlement> {
  const { returnRequest, actorUserId } = input

  const lines = returnRequest.items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      productId: item.orderItem.productId,
      quantity: item.quantity,
      // Priced at what the customer originally paid so the replacement's value is visible on
      // the order, while the order total stays zero because nothing is owed.
      unitPrice: item.orderItem.unitPrice,
      totalPrice: toDecimal(toCents(item.orderItem.unitPrice) * item.quantity),
      unitCost: item.orderItem.unitCost,
      productName: item.orderItem.productName,
      productSku: item.orderItem.productSku,
      productImage: item.orderItem.productImage,
    }))

  if (lines.length === 0) {
    throw new ReturnSettlementError('This return has no items to replace.', 400)
  }

  const now = new Date()

  const order = await prisma.order.create({
    data: {
      orderNumber: generateExchangeOrderNumber(now),
      userId: returnRequest.order.userId,
      guestEmail: returnRequest.order.guestEmail,
      // Ships to wherever the original went.
      shippingAddressId: returnRequest.order.shippingAddressId,
      subtotal: new Prisma.Decimal(0),
      shippingCost: new Prisma.Decimal(0),
      tax: new Prisma.Decimal(0),
      discountAmount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
      // Nothing is owed, so it is not awaiting payment — it is awaiting picking.
      paymentStatus: 'PAID',
      status: 'PROCESSING',
      paymentMethod: 'Exchange',
      salesChannel: 'MANUAL',
      exchangeForReturnId: returnRequest.id,
      customerNotes: `Replacement for return ${returnRequest.rmaNumber} on order ${returnRequest.order.orderNumber}`,
      items: { create: lines },
    },
    select: { id: true, orderNumber: true },
  })

  // After the order commits, because adjustInventory opens its own transaction. A failure here
  // leaves an order to pick with stock not yet deducted, which a stock count corrects — the
  // opposite order would deduct stock for an order that does not exist.
  for (const line of lines) {
    try {
      await adjustInventory({
        productId: line.productId,
        quantity: -line.quantity,
        type: 'SALE',
        reason: `Exchange ${order.orderNumber} for return ${returnRequest.rmaNumber}`,
        orderId: order.id,
        userId: actorUserId,
      })
    } catch (error) {
      console.error('[Return] Exchange inventory deduction failed:', {
        orderId: order.id,
        productId: line.productId,
        error,
      })
    }
  }

  return {
    outcome: 'EXCHANGE',
    valueCents,
    exchangeOrderId: order.id,
    exchangeOrderNumber: order.orderNumber,
  }
}
