import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeGroupName } from '@/lib/fundraising-site/checkout-fields'

export type GroupProgress = { orders: number; earned: number }

/**
 * How a group is doing so far, from the fundraiser record its mirrored
 * BigCommerce orders are credited to. Null before its first order, or when
 * the database cannot be read — the page then simply leaves the figures out.
 */
export async function getGroupProgress(label: string): Promise<GroupProgress | null> {
  try {
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { bigCommerceGroup: normalizeGroupName(label) },
      select: { totalOrders: true, totalCommission: true },
    })
    if (!fundraiser || fundraiser.totalOrders === 0) return null
    return { orders: fundraiser.totalOrders, earned: Number(fundraiser.totalCommission) }
  } catch {
    return null
  }
}
