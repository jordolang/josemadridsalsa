'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import UpdateStatusDialog from '@/components/admin/UpdateStatusDialog'
import TrackingDialog from '@/components/admin/TrackingDialog'
import RefundDialog from '@/components/admin/RefundDialog'
import SendEmailDialog from '@/components/admin/SendEmailDialog'
import BuyShippingLabelDialog from '@/components/admin/BuyShippingLabelDialog'
import PackingSlipButton from '@/components/admin/PackingSlipButton'
import type { OrderStatus } from '@/lib/admin/order-primary-cta'

export interface OrderActionContext {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: string
  trackingNumber: string | null
  customerEmail: string
  total: number
  refundableAmount: number
  hasShippingAddress: boolean
}

interface OrderActionsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: OrderActionContext
}

export function OrderActionsDrawer({
  open,
  onOpenChange,
  order,
}: OrderActionsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex items-center justify-between text-left">
          <DrawerTitle>Order actions</DrawerTitle>
          <DrawerClose asChild>
            <Button size="icon" variant="ghost" aria-label="Close actions">
              <X className="size-5" aria-hidden />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <UpdateStatusDialog
            orderId={order.id}
            orderNumber={order.orderNumber}
            currentStatus={order.status}
          />
          <TrackingDialog
            orderId={order.id}
            orderNumber={order.orderNumber}
            currentTrackingNumber={order.trackingNumber}
            currentStatus={order.status}
          />
          <BuyShippingLabelDialog
            orderId={order.id}
            orderNumber={order.orderNumber}
            hasShippingAddress={order.hasShippingAddress}
          />
          <RefundDialog
            orderId={order.id}
            orderNumber={order.orderNumber}
            totalPaid={order.total}
            refundableAmount={order.refundableAmount}
            paymentStatus={order.paymentStatus}
          />
          <SendEmailDialog
            orderId={order.id}
            orderNumber={order.orderNumber}
            customerEmail={order.customerEmail}
            trackingNumber={order.trackingNumber}
          />
          <Button asChild variant="outline" className="h-11 w-full">
            <Link
              href={`/admin/orders/${order.id}/invoice`}
              target="_blank"
              rel="noreferrer"
            >
              View invoice (PDF)
            </Link>
          </Button>
          <PackingSlipButton orderId={order.id} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
