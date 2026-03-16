'use client'

import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PackingSlipButtonProps {
  orderId: string
}

export default function PackingSlipButton({ orderId }: PackingSlipButtonProps) {
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => window.open(`/admin/orders/${orderId}/packing-slip`, '_blank')}
    >
      <Package className="mr-2 h-4 w-4" />
      Print Packing Slip
    </Button>
  )
}
