import { Loader2 } from 'lucide-react'

export default function OrdersLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading orders...</p>
      </div>
    </div>
  )
}
