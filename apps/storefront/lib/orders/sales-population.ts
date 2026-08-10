import type { Prisma } from '@prisma/client'

/**
 * What counts as a sale.
 *
 * Not every `Order` row is revenue. A replacement raised by an exchange is an order — it gets
 * picked, packed and shipped like any other — but the customer paid for those goods once, on the
 * original order. Its total is zero while its items carry a real `unitCost`, so counting it as a
 * sale reports a loss on every exchange and drags average order value down with a £0 order.
 *
 * Spelled out once here rather than repeated at each call site, because the failure mode is a
 * new report that forgets the clause and quietly disagrees with every existing one.
 *
 * Compose it into a revenue query's `where`:
 *
 * ```ts
 * const where: Prisma.OrderWhereInput = { ...SALES_ONLY, createdAt: range }
 * ```
 */
export const SALES_ONLY = {
  /** Non-null means the order is a replacement, not a sale. See `Order.exchangeForReturnId`. */
  exchangeForReturnId: null,
} satisfies Prisma.OrderWhereInput

/**
 * The same exclusion expressed for a query rooted at `OrderItem` rather than `Order`.
 */
export const SALES_ONLY_ITEMS = {
  order: SALES_ONLY,
} satisfies Prisma.OrderItemWhereInput
