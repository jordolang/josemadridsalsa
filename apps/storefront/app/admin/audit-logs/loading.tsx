import { Loader2 } from 'lucide-react'

export default function AuditLogsLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading audit logs...</p>
      </div>
    </div>
  )
}
