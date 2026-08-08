import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { PurchaseOrderStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  isClosedPurchaseOrder,
  PURCHASE_ORDER_STATUS_LABELS,
  purchaseOrderSubtotalCents,
} from '@/lib/purchasing/receiving'

export const metadata = { title: 'Purchase orders | Jose Madrid Salsa Admin' }

const STATUS_VARIANT: Record<
  PurchaseOrderStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'outline',
  SUBMITTED: 'secondary',
  PARTIALLY_RECEIVED: 'secondary',
  RECEIVED: 'default',
  CANCELLED: 'destructive',
}

const currency = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'inventory:read'))) {
      redirect('/admin')
    }

    const { status } = await searchParams
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: status && status !== 'all' ? { status: status as PurchaseOrderStatus } : {},
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include: {
        supplier: { select: { id: true, name: true } },
        items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
      },
    })

    // The operational queue: anything still expecting stock to turn up.
    const outstanding = purchaseOrders.filter((po) => !isClosedPurchaseOrder(po.status))

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchase orders</h1>
            <p className="text-sm text-muted-foreground">
              {outstanding.length} awaiting stock · {purchaseOrders.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/purchase-orders/suppliers">Suppliers</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/purchase-orders/new">New purchase order</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'DRAFT', label: 'Drafts' },
            { key: 'SUBMITTED', label: 'Submitted' },
            { key: 'PARTIALLY_RECEIVED', label: 'Partially received' },
            { key: 'RECEIVED', label: 'Received' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ].map((filter) => (
            <Button
              key={filter.key}
              asChild
              size="sm"
              variant={
                (status ?? 'all') === filter.key || (!status && filter.key === 'all')
                  ? 'default'
                  : 'outline'
              }
            >
              <Link href={`/admin/purchase-orders?status=${filter.key}`}>{filter.label}</Link>
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {purchaseOrders.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No purchase orders yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A purchase order records what you ordered from a supplier, and receiving it
                  puts the stock on the shelf.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Expected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po) => {
                      const ordered = po.items.reduce((s, i) => s + i.quantityOrdered, 0)
                      const received = po.items.reduce((s, i) => s + i.quantityReceived, 0)
                      const value =
                        purchaseOrderSubtotalCents(
                          po.items.map((i) => ({
                            quantityOrdered: i.quantityOrdered,
                            unitCost: Number(i.unitCost),
                          }))
                        ) + Math.round(Number(po.shippingCost) * 100)

                      return (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/admin/purchase-orders/${po.id}`}
                              className="hover:underline"
                            >
                              {po.poNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{po.supplier.name}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[po.status]}>
                              {PURCHASE_ORDER_STATUS_LABELS[po.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {received} / {ordered}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {currency(value)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {po.expectedAt
                              ? new Date(po.expectedAt).toLocaleDateString('en-US')
                              : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    // redirect() and notFound() throw by design; rethrowing keeps them working.
    if (isNextControlFlowError(error)) throw error
    console.error('Purchase orders page error:', error)
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Could not load purchase orders.</p>
      </div>
    )
  }
}
