import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { PirateShipQueue } from '@/components/admin/shipping/PirateShipQueue'

export const dynamic = 'force-dynamic'

/**
 * Fulfillment queue: paid orders that haven't shipped yet, ready to batch-export
 * to Pirate Ship and to import tracking back from.
 */
async function getQueue() {
  return prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
      paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      shippingAddress: { select: { city: true, state: true } },
      _count: { select: { items: true } },
    },
  })
}

export default async function ShippingQueuePage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin')
  }

  const [canExport, canWrite] = await Promise.all([
    hasPermission(user, 'orders:export'),
    hasPermission(user, 'orders:write'),
  ])

  const orders = await getQueue()

  const rows = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    customerName: order.user?.name || order.guestEmail || 'Guest',
    destination: order.shippingAddress
      ? `${order.shippingAddress.city}, ${order.shippingAddress.state}`
      : null,
    itemCount: order._count.items,
    hasAddress: !!order.shippingAddress,
  }))

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/admin/orders">
            <ArrowLeft className="mr-2 size-4" />
            Back to orders
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Ship Orders — Pirate Ship</h1>
        <p className="text-sm text-muted-foreground">
          Export unshipped paid orders to a Pirate Ship import file, buy &amp; print
          labels at your rates, then import the tracking export back to mark orders
          shipped.
        </p>
      </div>

      <PirateShipQueue rows={rows} canExport={canExport} canWrite={canWrite} />
    </div>
  )
}
