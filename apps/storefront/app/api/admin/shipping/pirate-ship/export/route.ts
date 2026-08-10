import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { buildPirateShipCsv } from '@/lib/shipping/pirate-ship'
import { shipmentInclude, toShipment } from '@/lib/shipping/pirate-ship-order'

/**
 * Batch Pirate Ship export.
 *
 * `GET` returns a single Pirate Ship import CSV covering many orders. Selection:
 * - `ids=<a,b,c>`  — export exactly these order ids (the fulfillment queue's
 *   "export selected" action). Order is preserved as requested.
 * - otherwise      — export every unshipped, paid order (default queue), oldest
 *   first, capped to avoid an unbounded response.
 *
 * Orders without a shipping address are silently skipped; the response's
 * `X-Skipped-Count` header reports how many.
 */
export async function GET(request: NextRequest) {
  await requirePermission('orders:export')

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('ids')

  let where: Prisma.OrderWhereInput
  let orderBy: Prisma.OrderOrderByWithRelationInput
  let take: number | undefined

  if (idsParam) {
    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 500)
    where = { id: { in: ids } }
    orderBy = { createdAt: 'asc' }
  } else {
    // Default queue: paid orders that haven't shipped yet.
    where = {
      status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
      paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
    }
    orderBy = { createdAt: 'asc' }
    take = 500
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy,
    take,
    include: shipmentInclude,
  })

  const shipments = orders
    .map((order) => toShipment(order))
    .filter((s): s is NonNullable<typeof s> => s !== null)

  const skipped = orders.length - shipments.length
  const csv = buildPirateShipCsv(shipments)
  const date = new Date().toISOString().split('T')[0]

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="pirateship-batch-${date}.csv"`,
      'X-Shipment-Count': String(shipments.length),
      'X-Skipped-Count': String(skipped),
    },
  })
}
