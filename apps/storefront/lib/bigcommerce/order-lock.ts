import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBigCommerceOrderSource } from './orders'

export const BIGCOMMERCE_ORDER_LOCKED_MESSAGE =
  'This order was placed in BigCommerce and is managed there. Make this change in the BigCommerce admin; this site keeps a read-only copy that updates itself.'

/**
 * A 409 for admin actions on a copied BigCommerce order, or null when the order
 * is this site's own. Shipping, refunding or re-emailing the copy would change
 * nothing in BigCommerce and would leave the two disagreeing.
 */
export async function bigCommerceOrderLock(orderId: string): Promise<NextResponse | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { importSource: true } })
  if (!isBigCommerceOrderSource(order?.importSource)) return null
  return NextResponse.json({ error: BIGCOMMERCE_ORDER_LOCKED_MESSAGE }, { status: 409 })
}
