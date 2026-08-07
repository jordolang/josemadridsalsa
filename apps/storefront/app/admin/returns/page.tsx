import Link from 'next/link'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RETURN_STATUS_LABELS, isTerminalReturnStatus } from '@/lib/orders/returns'
import type { ReturnStatus } from '@prisma/client'

export const metadata = { title: 'Returns | Jose Madrid Salsa Admin' }

const STATUS_VARIANT: Record<ReturnStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  REQUESTED: 'outline',
  APPROVED: 'secondary',
  RECEIVED: 'secondary',
  COMPLETED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:read'))) {
      redirect('/admin')
    }

    const { status } = await searchParams
    const returns = await prisma.returnRequest.findMany({
      where: status && status !== 'all' ? { status: status as ReturnStatus } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        order: {
          select: { id: true, orderNumber: true, guestEmail: true, user: { select: { name: true } } },
        },
        items: true,
      },
    })

    // The queue that matters operationally: anything still needing a human.
    const open = returns.filter((r) => !isTerminalReturnStatus(r.status))

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
          <p className="text-sm text-muted-foreground">
            {open.length} open · {returns.length} total
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {returns.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No returns yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RMA</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((returnRequest) => (
                    <TableRow key={returnRequest.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/returns/${returnRequest.id}`}
                          className="text-primary hover:underline"
                        >
                          {returnRequest.rmaNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/orders/${returnRequest.order.id}`}
                          className="text-primary hover:underline"
                        >
                          {returnRequest.order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {returnRequest.order.user?.name ??
                          returnRequest.order.guestEmail ??
                          'Guest'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {returnRequest.reason.replace(/_/g, ' ').toLowerCase()}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {returnRequest.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[returnRequest.status]}>
                          {RETURN_STATUS_LABELS[returnRequest.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {returnRequest.createdAt.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('[Returns] Error rendering:', error)
    throw new Error('Failed to load returns')
  }
}
