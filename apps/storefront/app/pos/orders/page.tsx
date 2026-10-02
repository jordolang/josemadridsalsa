'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils'

interface POSOrder {
  id: string
  orderNumber: string
  total: number
  itemCount: number
  status: string
  paymentMethod: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  VOIDED: 'bg-red-100 text-red-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  SQUARE_TERMINAL: 'Card (Terminal)',
  SQUARE_READER: 'Card (Reader)',
}

function paymentLabel(payments: unknown): string {
  const latest = Array.isArray(payments) ? (payments[0] as { methodType?: string | null; provider?: string | null } | undefined) : undefined
  if (!latest) return 'Unpaid'
  const method = latest.methodType ?? latest.provider ?? ''
  return METHOD_LABELS[method] ?? (method ? method.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'Unknown')
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function POSOrdersPage() {
  const [orders, setOrders] = useState<POSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchOrders() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/orders?channel=POS&limit=50')
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to load orders' }))
        setError(body.error || 'Failed to load orders')
        return
      }
      const data = await res.json()
      const items: unknown[] = Array.isArray(data) ? data : data.data ?? data.orders ?? []
      setOrders(
        items.map((o: unknown) => {
          const order = o as Record<string, unknown>
          const lineItems = Array.isArray(order.items) ? order.items : []
          const itemCount =
            typeof order.itemCount === 'number'
              ? order.itemCount
              : lineItems.reduce(
                  (sum: number, li: unknown) =>
                    sum + (typeof (li as Record<string, unknown>).quantity === 'number'
                      ? ((li as Record<string, unknown>).quantity as number)
                      : 1),
                  0
                )
          return {
            id: String(order.id ?? ''),
            orderNumber: String(order.orderNumber ?? order.order_number ?? ''),
            total: Number(order.total ?? 0),
            itemCount,
            status: String(order.status ?? 'PENDING'),
            paymentMethod: paymentLabel(order.payments),
            createdAt: String(order.createdAt ?? order.created_at ?? new Date().toISOString()),
          }
        })
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Recent Orders</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading && orders.length === 0 && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading orders...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            No POS orders yet today
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {order.orderNumber}
                    </p>
                    <p className="text-sm text-slate-500">
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      {' '}&middot;{' '}
                      {order.paymentMethod}
                      {' '}&middot;{' '}
                      {formatTime(order.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge
                    className={
                      STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-600'
                    }
                  >
                    {order.status}
                  </Badge>
                  <span className="text-lg font-bold text-slate-900">
                    {formatPrice(order.total)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
