import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LowStockAlertProps {
  inventory: number
  threshold: number
  className?: string
}

export function LowStockAlert({
  inventory,
  threshold,
  className,
}: LowStockAlertProps) {
  const isLowStock = inventory <= threshold

  if (!isLowStock) {
    return null
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-destructive bg-destructive/10 text-destructive',
        className
      )}
    >
      <AlertTriangle className="mr-1 size-3" />
      Low Stock
    </Badge>
  )
}
