import { Loader2 } from 'lucide-react'

export default function TrainingDataLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading training data...</p>
      </div>
    </div>
  )
}
