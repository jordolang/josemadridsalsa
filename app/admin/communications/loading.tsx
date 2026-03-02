import { Loader2 } from 'lucide-react'

export default function CommunicationsLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-salsa-500 mx-auto mb-4" />
        <p className="text-muted-foreground">Loading communications...</p>
      </div>
    </div>
  )
}
