import { Loader2 } from 'lucide-react'

export default function PublicLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <Loader2 className="w-16 h-16 animate-spin text-salsa-500 mx-auto mb-4" />
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
