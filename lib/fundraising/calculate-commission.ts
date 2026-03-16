import { Decimal } from '@prisma/client/runtime/library'

/**
 * Calculate commission earned for a fundraiser participant
 *
 * @param orderTotal - The total amount of the order
 * @param commissionRate - The commission rate as a decimal (e.g., 0.40 for 40%)
 * @returns The commission amount
 *
 * @example
 * ```ts
 * const commission = calculateCommission(new Decimal('125.00'), new Decimal('0.40'))
 * // Returns Decimal('50.00') - 40% of $125.00
 * ```
 */
export function calculateCommission(
  orderTotal: Decimal,
  commissionRate: Decimal
): Decimal {
  return orderTotal.mul(commissionRate)
}

/**
 * Calculate commission earned for a fundraiser participant (number version)
 *
 * @param orderTotal - The total amount of the order as a number
 * @param commissionRate - The commission rate as a decimal number (e.g., 0.40 for 40%)
 * @returns The commission amount as a Decimal
 *
 * @example
 * ```ts
 * const commission = calculateCommissionFromNumber(125.00, 0.40)
 * // Returns Decimal('50.00') - 40% of $125.00
 * ```
 */
export function calculateCommissionFromNumber(
  orderTotal: number,
  commissionRate: number
): Decimal {
  return new Decimal(orderTotal).mul(new Decimal(commissionRate))
}

/**
 * Calculate total commission for multiple orders
 *
 * @param orders - Array of order totals
 * @param commissionRate - The commission rate as a decimal (e.g., 0.40 for 40%)
 * @returns The total commission amount
 *
 * @example
 * ```ts
 * const orders = [new Decimal('100.00'), new Decimal('200.00')]
 * const totalCommission = calculateTotalCommission(orders, new Decimal('0.35'))
 * // Returns Decimal('105.00') - 35% of $300.00
 * ```
 */
export function calculateTotalCommission(
  orders: Decimal[],
  commissionRate: Decimal
): Decimal {
  const totalRevenue = orders.reduce(
    (sum, order) => sum.add(order),
    new Decimal('0.00')
  )
  return totalRevenue.mul(commissionRate)
}
