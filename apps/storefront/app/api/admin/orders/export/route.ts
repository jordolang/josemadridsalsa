import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { parseQuery } from '@/lib/api'
import { buildOrderWhere, parseOrderFilters } from '@/lib/orders/order-filters'

export async function GET(request: NextRequest) {
  await requirePermission('orders:export')

  // Shares the orders list's filter module, so exporting a filtered view returns exactly the
  // rows on screen. Previously this understood only `status` and a date range, which meant
  // any newer filter silently exported everything.
  const query = parseQuery(request) as Record<string, string | undefined>
  const where = buildOrderWhere(parseOrderFilters(query))

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  // Build CSV
  const headers = [
    'Order Number',
    'Customer Name',
    'Customer Email',
    'Status',
    'Fulfillment Status',
    'Sales Channel',
    'Payment Status',
    'Subtotal',
    'Shipping',
    'Tax',
    'Discount',
    'Total',
    'Items',
    'Created At',
  ]

  const rows = orders.map((order) => {
    const itemsSummary = order.items
      .map((item) => `${item.quantity}x ${item.productName}`)
      .join('; ')

    return [
      order.orderNumber,
      order.user?.name || order.guestEmail || 'Guest',
      order.user?.email || order.guestEmail || '',
      order.status,
      order.fulfillmentStatus,
      order.salesChannel,
      order.paymentStatus,
      order.subtotal.toString(),
      order.shippingCost.toString(),
      order.tax.toString(),
      order.discountAmount.toString(),
      order.total.toString(),
      itemsSummary,
      order.createdAt.toISOString(),
    ]
  })

  // Convert to CSV
  const csv = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
