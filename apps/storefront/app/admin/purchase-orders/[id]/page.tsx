import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { PurchaseOrderStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ReceiveItemsDialog } from '@/components/admin/ReceiveItemsDialog'
import { PurchaseOrderActions } from '@/components/admin/PurchaseOrderActions'
import {
  canReceive,
  PURCHASE_ORDER_STATUS_LABELS,
  purchaseOrderSubtotalCents,
} from '@/lib/purchasing/receiving'

export const metadata = { title: 'Purchase order | Jose Madrid Salsa Admin' }

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

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'inventory:read'))) {
      redirect('/admin')
    }

    const { id } = await params
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: { select: { name: true, email: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, inventory: true } } },
        },
        receipts: {
          orderBy: { receivedAt: 'desc' },
          include: {
            receivedBy: { select: { name: true } },
            items: { select: { id: true, purchaseOrderItemId: true, quantity: true } },
          },
        },
      },
    })

    if (!po) notFound()

    const subtotalCents = purchaseOrderSubtotalCents(
      po.items.map((i) => ({ quantityOrdered: i.quantityOrdered, unitCost: Number(i.unitCost) }))
    )
    const shippingCents = Math.round(Number(po.shippingCost) * 100)
    const canWrite = await hasPermission(user, 'products:write')
    const itemsById = new Map(po.items.map((item) => [item.id, item]))

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/purchase-orders"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Purchase orders
            </Link>
            <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold tracking-tight">
              <span className="font-mono">{po.poNumber}</span>
              <Badge variant={STATUS_VARIANT[po.status]}>
                {PURCHASE_ORDER_STATUS_LABELS[po.status]}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {po.supplier.name}
              {po.expectedAt
                ? ` · expected ${new Date(po.expectedAt).toLocaleDateString('en-US')}`
                : ''}
            </p>
          </div>

          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <PurchaseOrderActions
                purchaseOrderId={po.id}
                status={po.status}
                hasItems={po.items.length > 0}
              />
              {canReceive(po.status) && (
                <ReceiveItemsDialog
                  purchaseOrderId={po.id}
                  poNumber={po.poNumber}
                  items={po.items.map((item) => ({
                    id: item.id,
                    productName: item.product.name,
                    productSku: item.product.sku,
                    quantityOrdered: item.quantityOrdered,
                    quantityReceived: item.quantityReceived,
                  }))}
                />
              )}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                    <TableHead className="text-right">In stock now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items.map((item) => {
                    const outstanding = item.quantityOrdered - item.quantityReceived
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.product.name}</div>
                          <div className="text-xs text-muted-foreground">{item.product.sku}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantityOrdered}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantityReceived}
                          {outstanding > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({outstanding} to come)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currency(Math.round(Number(item.unitCost) * 100))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currency(
                            Math.round(Number(item.unitCost) * 100) * item.quantityOrdered
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {item.product.inventory}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <dl className="mt-4 space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{currency(subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="tabular-nums">{currency(shippingCents)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(subtotalCents + shippingCents)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            {po.receipts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing received yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {po.receipts.map((receipt) => (
                  <li key={receipt.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        {new Date(receipt.receivedAt).toLocaleString('en-US')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {receipt.reference ? `Ref ${receipt.reference} · ` : ''}
                        {receipt.receivedBy?.name ?? 'Unknown'}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                      {receipt.items.map((line) => {
                        const item = itemsById.get(line.purchaseOrderItemId)
                        return (
                          <li key={line.id}>
                            {line.quantity} × {item?.product.name ?? 'Unknown product'}
                          </li>
                        )
                      })}
                    </ul>
                    {receipt.notes && <p className="mt-2 text-sm">{receipt.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {(po.notes || po.supplier.email || po.supplier.phone) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supplier &amp; notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{po.supplier.name}</p>
              {po.supplier.contactName && (
                <p className="text-muted-foreground">{po.supplier.contactName}</p>
              )}
              {po.supplier.email && <p className="text-muted-foreground">{po.supplier.email}</p>}
              {po.supplier.phone && <p className="text-muted-foreground">{po.supplier.phone}</p>}
              {po.notes && <p className="border-t pt-2">{po.notes}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('Purchase order detail error:', error)
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Could not load this purchase order.</p>
      </div>
    )
  }
}
