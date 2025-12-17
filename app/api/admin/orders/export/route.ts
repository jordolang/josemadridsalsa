import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { parseQuery } from '@/lib/api'

export async function GET(request: NextRequest) {
  await requirePermission('orders:export')

  const query = parseQuery(request)
  const where: any = {}

  // Apply same filters as list
  if (query.status && query.status !== 'all') {
    where.status = query.status
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {}
    if (query.startDate) {
      where.createdAt.gte = new Date(query.startDate)
    }
    if (query.endDate) {
      where.createdAt.lte = new Date(query.endDate)
    }
  }

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
