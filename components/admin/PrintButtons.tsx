'use client'

import { FileText, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PrintButtonsProps {
  orderId: string
}

export default function PrintButtons({ orderId }: PrintButtonsProps) {
  const openInvoice = () => {
    window.open(`/admin/orders/${orderId}/invoice`, '_blank')
  }

  const openPackingSlip = () => {
    window.open(`/admin/orders/${orderId}/packing-slip`, '_blank')
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={openInvoice}>
        <FileText className="mr-2 h-4 w-4" />
        Print Invoice
      </Button>
      <Button variant="outline" className="w-full" onClick={openPackingSlip}>
        <Package className="mr-2 h-4 w-4" />
        Print Packing Slip
      </Button>
    </>
  )
}
