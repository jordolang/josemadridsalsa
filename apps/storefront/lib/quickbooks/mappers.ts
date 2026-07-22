/**
 * Pure mapping from our order records to QuickBooks Online payloads.
 *
 * Kept free of Prisma and network calls so the arithmetic — which is the part
 * that can silently misstate the books — is unit-testable on its own.
 *
 * Money note: orders carry Decimal(10,2) dollars while Payment/Refund carry Int
 * cents. Everything here works in dollars; callers convert at the boundary with
 * `centsToDollars`.
 */

/** QBO reference object: `{ value: "<id>" }`. */
export interface QboRef {
  value: string
  name?: string
}

export interface SalesItemLine {
  DetailType: 'SalesItemLineDetail'
  Amount: number
  Description?: string
  SalesItemLineDetail: {
    ItemRef: QboRef
    Qty?: number
    UnitPrice?: number
  }
}

export interface DiscountLine {
  DetailType: 'DiscountLineDetail'
  Amount: number
  Description?: string
  DiscountLineDetail: {
    PercentBased: false
    DiscountAccountRef: QboRef
  }
}

export type SalesReceiptLine = SalesItemLine | DiscountLine

export interface SalesReceiptPayload {
  CustomerRef: QboRef
  TxnDate: string
  DocNumber?: string
  PrivateNote?: string
  Line: SalesReceiptLine[]
  TxnTaxDetail?: { TotalTax: number }
  DepositToAccountRef?: QboRef
}

/** The order fields the mapping needs, already converted to plain numbers. */
export interface OrderForSync {
  id: string
  orderNumber: string
  createdAt: Date
  subtotal: number
  shippingCost: number
  tax: number
  discountAmount: number
  giftCertificateAmount: number
  total: number
  customerEmail: string | null
  customerFirstName?: string | null
  customerLastName?: string | null
  items: Array<{
    productId: string
    productName: string
    productSku: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
}

export interface SyncSettings {
  incomeAccountId?: string | null
  depositAccountId?: string | null
  shippingItemId?: string | null
  discountAccountId?: string | null
  giftCertificateAccountId?: string | null
}

export type MappingResult =
  | { ok: true; payload: SalesReceiptPayload }
  /**
   * A condition retrying will never fix — a missing account mapping, or numbers
   * that don't add up. Posting anyway would put a wrong figure in the books, so
   * these are surfaced for a human instead.
   */
  | { ok: false; reason: string }

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export const centsToDollars = (cents: number): number => round2(cents / 100)

/** QBO rejects a DocNumber longer than 21 characters. */
const MAX_DOC_NUMBER = 21

/** Tolerance for the total cross-check: half a cent, to absorb float noise. */
const TOTAL_TOLERANCE = 0.005

/** QBO wants a date-only string; the receipt is dated when the order was placed. */
export function toTxnDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * DisplayName is unique per company in QBO, so it has to be derived from
 * something stable and unique on our side. Email is both; the name is only
 * decoration on top of it.
 */
export function buildCustomerPayload(order: OrderForSync) {
  const email = order.customerEmail?.trim() || null
  const first = order.customerFirstName?.trim() || ''
  const last = order.customerLastName?.trim() || ''
  const humanName = [first, last].filter(Boolean).join(' ')

  return {
    DisplayName: humanName && email ? `${humanName} (${email})` : (email ?? humanName),
    ...(first && { GivenName: first }),
    ...(last && { FamilyName: last }),
    ...(email && { PrimaryEmailAddr: { Address: email } }),
  }
}

/**
 * Products sync as non-inventory items: we track stock on our side, and mirroring
 * inventory into QBO would create a second source of truth for quantity.
 */
export function buildItemPayload(
  product: { name: string; sku: string },
  incomeAccountId: string
) {
  return {
    Name: product.name,
    Sku: product.sku,
    Type: 'NonInventory' as const,
    IncomeAccountRef: { value: incomeAccountId },
  }
}

/**
 * Build the SalesReceipt for a paid order.
 *
 * Refuses rather than guesses: every money line needs an account mapped, and the
 * assembled lines must reconcile to the order total. A receipt that posts a
 * different number than the customer actually paid is worse than no receipt.
 */
export function buildSalesReceipt(input: {
  order: OrderForSync
  customerId: string
  /** Local product id -> QBO Item id, resolved by the sync engine. */
  itemIds: Record<string, string>
  settings: SyncSettings
}): MappingResult {
  const { order, customerId, itemIds, settings } = input

  if (order.items.length === 0) {
    return { ok: false, reason: 'Order has no line items' }
  }

  const lines: SalesReceiptLine[] = []

  for (const item of order.items) {
    const itemId = itemIds[item.productId]
    if (!itemId) {
      return { ok: false, reason: `No QuickBooks item mapped for product ${item.productSku}` }
    }
    lines.push({
      DetailType: 'SalesItemLineDetail',
      Amount: round2(item.totalPrice),
      Description: item.productName,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: item.quantity,
        UnitPrice: round2(item.unitPrice),
      },
    })
  }

  if (order.shippingCost > 0) {
    if (!settings.shippingItemId) {
      return { ok: false, reason: 'Order has shipping but no shipping item is mapped' }
    }
    lines.push({
      DetailType: 'SalesItemLineDetail',
      Amount: round2(order.shippingCost),
      Description: 'Shipping',
      SalesItemLineDetail: {
        ItemRef: { value: settings.shippingItemId },
        Qty: 1,
        UnitPrice: round2(order.shippingCost),
      },
    })
  }

  if (order.discountAmount > 0) {
    if (!settings.discountAccountId) {
      return { ok: false, reason: 'Order has a discount but no discount account is mapped' }
    }
    lines.push({
      DetailType: 'DiscountLineDetail',
      Amount: round2(order.discountAmount),
      Description: 'Checkout discount',
      DiscountLineDetail: {
        PercentBased: false,
        DiscountAccountRef: { value: settings.discountAccountId },
      },
    })
  }

  // A redeemed gift certificate is a liability being drawn down, not a discount
  // on the sale, and QBO allows only one discount line per receipt. Posting it
  // as a discount would understate revenue and leave the liability on the books
  // forever, so it is held until that account is mapped and handled properly.
  if (order.giftCertificateAmount > 0) {
    return {
      ok: false,
      reason:
        'Order was partly paid with a gift certificate; redemption needs a liability account mapping',
    }
  }

  const lineTotal = lines.reduce(
    (sum, line) => sum + (line.DetailType === 'DiscountLineDetail' ? -line.Amount : line.Amount),
    0
  )
  const expected = round2(lineTotal + order.tax)

  if (Math.abs(expected - round2(order.total)) > TOTAL_TOLERANCE) {
    return {
      ok: false,
      reason: `Line total ${expected.toFixed(2)} does not match order total ${round2(order.total).toFixed(2)}`,
    }
  }

  return {
    ok: true,
    payload: {
      CustomerRef: { value: customerId },
      TxnDate: toTxnDate(order.createdAt),
      DocNumber: order.orderNumber.slice(0, MAX_DOC_NUMBER),
      PrivateNote: `Website order ${order.orderNumber} (${order.id})`,
      Line: lines,
      ...(order.tax > 0 && { TxnTaxDetail: { TotalTax: round2(order.tax) } }),
      ...(settings.depositAccountId && {
        DepositToAccountRef: { value: settings.depositAccountId },
      }),
    },
  }
}
