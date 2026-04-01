'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
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
  const [success, setSuccess] = useState<string | null>(null)

  const allSelected = orders.length > 0 && selectedIds.size === orders.length
  const someSelected = selectedIds.size > 0

  function handleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)))
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
    setSuccess(null)

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

      setSuccess(`Updated ${data.updated} order(s) to ${status}${data.skipped > 0 ? ` (${data.skipped} skipped)` : ''}`)
      setSelectedIds(new Set())
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update orders')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleExportSelected() {
    if (selectedIds.size === 0) return
    // Build CSV export URL with selected order IDs
    const ids = Array.from(selectedIds).join(',')
    window.open(`/api/admin/orders/export?ids=${encodeURIComponent(ids)}`, '_blank')
  }

  return (
    <div>
      {/* Bulk actions bar */}
      {someSelected && canWrite && (
        <div className="flex items-center gap-3 border-b bg-blue-50 px-6 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessing}
                className="gap-1"
              >
                Update Status
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {BULK_STATUSES.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => handleBulkStatus(status)}
                >
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${
                      statusColors[status]?.split(' ')[0] || 'bg-gray-300'
                    }`}
                  />
                  {status.charAt(0) + status.slice(1).toLowerCase()}
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
      )}

      {/* Feedback messages */}
      {error && (
        <div className="border-b bg-red-50 px-6 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="border-b bg-green-50 px-6 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-slate-50">
            <tr>
              {canWrite && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected
                    }}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    aria-label="Select all orders"
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                Order
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                Items
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                Total
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                Date
              </th>
              <th className="px-6 py-3 text-right text-sm font-medium text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? 8 : 7}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className={`hover:bg-slate-50 ${
                    selectedIds.has(order.id) ? 'bg-blue-50/50' : ''
                  }`}
                >
                  {canWrite && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => handleSelectRow(order.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Select order ${order.orderNumber}`}
                      />
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm">{order.customerName}</td>
                  <td className="px-6 py-4 text-sm">
                    {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    ${Number(order.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        statusColors[order.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/orders/${order.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
