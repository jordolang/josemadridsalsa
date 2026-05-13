'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getOrderPrimaryCta } from '@/lib/admin/order-primary-cta'
import {
  OrderActionsDrawer,
  type OrderActionContext,
} from './OrderActionsDrawer'

interface OrderActionBarProps {
  order: OrderActionContext
}

export function OrderActionBar({ order }: OrderActionBarProps) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const cta = getOrderPrimaryCta({
    status: order.status,
    hasTracking: Boolean(order.trackingNumber),
  })

  const handlePrimary = async () => {
    if (cta.action === 'update-status' && cta.nextStatus) {
      setPending(true)
      try {
        const response = await fetch(
          `/api/admin/orders/${order.id}/update-status`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: cta.nextStatus }),
          },
        )
        if (!response.ok) {
          const data: { error?: string } = await response.json().catch(() => ({}))
          throw new Error(data.error ?? 'Failed to update status')
        }
        toast.success(`Order ${order.orderNumber} → ${cta.nextStatus}`)
        router.refresh()
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to update status'
        toast.error(message)
      } finally {
        setPending(false)
      }
      return
    }
    setDrawerOpen(true)
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Order actions"
        className="sticky bottom-0 z-30 flex items-center gap-2 border-t bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <Button
          className="h-11 flex-1 text-base"
          onClick={handlePrimary}
          disabled={pending}
        >
          {pending ? 'Updating…' : cta.label}
        </Button>
        <Button
          variant="outline"
          className="h-11 min-w-11 px-3"
          aria-label="More actions"
          onClick={() => setDrawerOpen(true)}
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </Button>
      </div>
      <OrderActionsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        order={order}
      />
    </>
  )
}
