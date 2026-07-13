'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Eye } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatOrderStatus, getOrderStatusVariant } from '@/lib/order-status'

interface OrderRow {
  id: string
  orderNumber: string
  status: string
  total: string | number
  createdAt: string
  customerName: string
  itemCount: number
}

interface OrdersTableClientProps {
  orders: OrderRow[]
  canWrite: boolean
}

const BULK_STATUSES = [
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const

export function OrdersTableClient({ orders, canWrite }: OrdersTableClientProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allSelected = orders.length > 0 && selectedIds.size === orders.length
  const someSelected = selectedIds.size > 0
  const indeterminate = someSelected && !allSelected

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(orders.map((o) => o.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  function handleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleBulkStatus(status: string) {
    if (selectedIds.size === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedIds),
          status,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update orders')
      }

      toast.success(
        `Updated ${data.updated} order${data.updated === 1 ? '' : 's'} to ${formatOrderStatus(status)}`,
        data.skipped > 0
          ? { description: `${data.skipped} order${data.skipped === 1 ? '' : 's'} skipped` }
          : undefined
      )
      setSelectedIds(new Set())
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update orders'
      setError(message)
      toast.error('Bulk update failed', { description: message })
    } finally {
      setIsProcessing(false)
    }
  }

  function handleExportSelected() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds).join(',')
    window.open(`/api/admin/orders/export?ids=${encodeURIComponent(ids)}`, '_blank')
  }

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      {someSelected && canWrite && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
          </span>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                  className="gap-1"
                >
                  Update Status
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {BULK_STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => handleBulkStatus(status)}
                  >
                    <Badge
                      variant={getOrderStatusVariant(status)}
                      className="mr-2"
                    >
                      {formatOrderStatus(status)}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              disabled={isProcessing}
            >
              Export Selected
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canWrite && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={indeterminate ? 'indeterminate' : allSelected}
                    onCheckedChange={(value) => handleSelectAll(value === true)}
                    aria-label="Select all orders"
                  />
                </TableHead>
              )}
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 8 : 7}
                  className="py-12 text-center text-muted-foreground"
                >
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const selected = selectedIds.has(order.id)
                return (
                  <TableRow
                    key={order.id}
                    data-state={selected ? 'selected' : undefined}
                  >
                    {canWrite && (
                      <TableCell>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => handleSelectRow(order.id)}
                          aria-label={`Select order ${order.orderNumber}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.itemCount}{' '}
                      {order.itemCount === 1 ? 'item' : 'items'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${Number(order.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getOrderStatusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          aria-label={`View order ${order.orderNumber}`}
                        >
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
