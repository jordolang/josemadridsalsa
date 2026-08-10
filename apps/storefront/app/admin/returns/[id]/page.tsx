import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ReturnActions } from '@/components/admin/ReturnActions'
import { ReturnLabelPanel } from '@/components/admin/ReturnLabelPanel'
import {
  RETURN_STATUS_LABELS,
  computeReturnRefundCents,
  isTerminalReturnStatus,
} from '@/lib/orders/returns'
import type { ReturnStatus } from '@prisma/client'

const STATUS_VARIANT: Record<ReturnStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  REQUESTED: 'outline',
  APPROVED: 'secondary',
  RECEIVED: 'secondary',
  COMPLETED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
}

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:read'))) {
      redirect('/admin')
    }

    const { id } = await params
    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            guestEmail: true,
            shippedAt: true,
            user: { select: { name: true, email: true } },
          },
        },
        items: { include: { orderItem: true } },
        refund: true,
        giftCertificate: { select: { code: true, balance: true, expiresAt: true } },
        exchangeOrder: { select: { id: true, orderNumber: true, status: true } },
      },
    })

    if (!returnRequest) notFound()

    const canWrite = await hasPermission(user, 'orders:write')

    const quantities = new Map(returnRequest.items.map((i) => [i.orderItemId, i.quantity]))
    const refundCents = computeReturnRefundCents(
      quantities,
      returnRequest.items.map((i) => ({
        id: i.orderItemId,
        quantity: i.orderItem.quantity,
        quantityFulfilled: i.orderItem.quantityFulfilled,
        unitPrice: Number(i.orderItem.unitPrice),
      })),
      returnRequest.restockingFee ? Number(returnRequest.restockingFee) : 0
    )

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
              <Link href="/admin/returns">
                <ArrowLeft className="mr-1 size-4" />
                Returns
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{returnRequest.rmaNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Order{' '}
              <Link
                href={`/admin/orders/${returnRequest.order.id}`}
                className="text-primary hover:underline"
              >
                {returnRequest.order.orderNumber}
              </Link>{' '}
              · {returnRequest.order.user?.name ?? returnRequest.order.guestEmail ?? 'Guest'}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[returnRequest.status]} className="mt-8">
            {RETURN_STATUS_LABELS[returnRequest.status]}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {returnRequest.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.orderItem.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.orderItem.productSku} · returning {item.quantity} of{' '}
                        {item.orderItem.quantityFulfilled} shipped
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.condition && (
                        <Badge variant={item.condition === 'RESELLABLE' ? 'secondary' : 'outline'}>
                          {item.condition.toLowerCase()}
                        </Badge>
                      )}
                      {item.restocked && <Badge variant="default">processed</Badge>}
                    </div>
                  </div>
                ))}

                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Refund due
                    {returnRequest.restockingFee
                      ? ` (less $${Number(returnRequest.restockingFee).toFixed(2)} fee)`
                      : ''}
                  </span>
                  <span className="font-medium tabular-nums">
                    ${(refundCents / 100).toFixed(2)}
                  </span>
                </div>
                {returnRequest.refund && (
                  <p className="text-xs text-muted-foreground">
                    Linked refund {returnRequest.refund.stripeRefundId} ·{' '}
                    {returnRequest.refund.status.toLowerCase()}
                  </p>
                )}
              </CardContent>
            </Card>

            {canWrite && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isTerminalReturnStatus(returnRequest.status) ? 'Outcome' : 'Next step'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReturnActions
                    returnId={returnRequest.id}
                    status={returnRequest.status}
                    restockingFee={
                      returnRequest.restockingFee ? Number(returnRequest.restockingFee) : null
                    }
                    items={returnRequest.items.map((item) => ({
                      id: item.id,
                      productName: item.orderItem.productName,
                      quantity: item.quantity,
                      condition: item.condition,
                    }))}
                    resolution={returnRequest.resolution}
                    refundValueCents={refundCents}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Return label</CardTitle>
              </CardHeader>
              <CardContent>
                <ReturnLabelPanel
                  returnId={returnRequest.id}
                  canWrite={canWrite}
                  isTerminal={isTerminalReturnStatus(returnRequest.status)}
                  label={{
                    url: returnRequest.returnLabelUrl,
                    trackingCode: returnRequest.returnLabelTrackingCode,
                    carrier: returnRequest.returnLabelCarrier,
                    service: returnRequest.returnLabelService,
                    costCents: returnRequest.returnLabelCostCents,
                    purchasedAt: returnRequest.returnLabelPurchasedAt,
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Reason" value={returnRequest.reason.replace(/_/g, ' ').toLowerCase()} />
              <Detail label="Resolution" value={returnRequest.resolution.toLowerCase()} />
              <Detail label="Requested" value={returnRequest.createdAt.toLocaleString()} />
              {returnRequest.approvedAt && (
                <Detail label="Approved" value={returnRequest.approvedAt.toLocaleString()} />
              )}
              {returnRequest.receivedAt && (
                <Detail label="Received" value={returnRequest.receivedAt.toLocaleString()} />
              )}
              {returnRequest.completedAt && (
                <Detail label="Completed" value={returnRequest.completedAt.toLocaleString()} />
              )}
              {returnRequest.customerNote && (
                <Detail label="Customer note" value={returnRequest.customerNote} />
              )}
              {returnRequest.adminNote && (
                <Detail label="Internal note" value={returnRequest.adminNote} />
              )}

              {/* What the resolution actually produced. Present on exactly one of the three. */}
              {returnRequest.refund && (
                <Detail
                  label="Refunded"
                  value={`$${(returnRequest.refund.amount / 100).toFixed(2)} — ${returnRequest.refund.status.toLowerCase()}`}
                />
              )}
              {returnRequest.giftCertificate && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Store credit
                  </p>
                  <p className="font-mono text-sm">{returnRequest.giftCertificate.code}</p>
                  <p className="text-xs text-muted-foreground">
                    ${Number(returnRequest.giftCertificate.balance).toFixed(2)} remaining
                    {returnRequest.giftCertificate.expiresAt
                      ? ` · expires ${returnRequest.giftCertificate.expiresAt.toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
              )}
              {returnRequest.exchangeOrder && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Replacement order
                  </p>
                  <Link
                    href={`/admin/orders/${returnRequest.exchangeOrder.id}`}
                    className="text-sm underline underline-offset-2"
                  >
                    {returnRequest.exchangeOrder.orderNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {returnRequest.exchangeOrder.status.toLowerCase()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('[Return detail] Error rendering:', error)
    throw new Error('Failed to load return')
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="capitalize">{value}</p>
    </div>
  )
}
