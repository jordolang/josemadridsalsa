'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShieldAlert, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BreachResult {
  id: string
  serviceName: string
  label: string
  username: string | null
  breached: boolean
  breachCount: number
  error?: string
}

interface CredentialBreachCheckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credentialId?: string
  credentialLabel?: string
}

export default function CredentialBreachCheckDialog({
  open,
  onOpenChange,
  credentialId,
  credentialLabel,
}: CredentialBreachCheckDialogProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [results, setResults] = useState<BreachResult[]>([])
  const [hasChecked, setHasChecked] = useState(false)

  const runCheck = async () => {
    setIsChecking(true)
    setResults([])

    try {
      const body: any = {}
      if (credentialId) body.credentialId = credentialId

      const response = await fetch('/api/admin/credentials/breach-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Breach check failed')

      setResults(data.results)
      setHasChecked(true)

      const breachedCount = data.results.filter((r: BreachResult) => r.breached).length
      if (breachedCount > 0) {
        toast.error('Breached Passwords Found', {
          description: `${breachedCount} password(s) found in known data breaches`,
        })
      } else {
        toast.success('All Clear', {
          description: 'No passwords found in known data breaches',
        })
      }
    } catch (err: any) {
      toast.error('Error', { description: err.message })
    } finally {
      setIsChecking(false)
    }
  }

  const handleClose = () => {
    setResults([])
    setHasChecked(false)
    onOpenChange(false)
  }

  const breachedResults = results.filter((r) => r.breached)
  const safeResults = results.filter((r) => !r.breached && !r.error)
  const errorResults = results.filter((r) => r.error)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Breach Check - HaveIBeenPwned
          </DialogTitle>
          <DialogDescription>
            {credentialId
              ? `Check if the password for "${credentialLabel}" has appeared in known data breaches.`
              : 'Check all credential passwords against the HaveIBeenPwned database using secure k-anonymity.'}
            {!credentialId && (
              <span className="mt-1 block text-xs">
                This may take a while for large lists (1.6s per credential for rate limiting).
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!hasChecked && !isChecking ? (
          <div className="py-6 text-center">
            <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <p className="text-sm text-slate-600">
              Click the button below to check{' '}
              {credentialId ? 'this credential' : 'all credentials'} against known data breaches.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Passwords are never sent in full. Only the first 5 characters of the SHA-1 hash are
              transmitted (k-anonymity).
            </p>
          </div>
        ) : isChecking ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
            <p className="text-sm font-medium">Checking credentials...</p>
            <p className="mt-1 text-xs text-slate-500">
              This may take a moment. Do not close this dialog.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold">{results.length}</p>
                <p className="text-xs text-slate-500">Checked</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{breachedResults.length}</p>
                <p className="text-xs text-red-600">Breached</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{safeResults.length}</p>
                <p className="text-xs text-green-600">Safe</p>
              </div>
            </div>

            {/* Breached Credentials */}
            {breachedResults.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Breached Passwords
                </h3>
                <div className="space-y-1">
                  {breachedResults.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{r.serviceName}</p>
                        <p className="text-xs text-slate-500">{r.label}</p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        Found {r.breachCount.toLocaleString()}x
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safe Credentials */}
            {safeResults.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-green-700">
                  <ShieldCheck className="h-4 w-4" />
                  Safe Passwords
                </h3>
                <div className="space-y-1">
                  {safeResults.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-2"
                    >
                      <p className="text-sm">{r.serviceName} - {r.label}</p>
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {errorResults.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-amber-700">
                  Errors ({errorResults.length})
                </h3>
                {errorResults.map((r) => (
                  <div key={r.id} className="text-xs text-amber-600">
                    {r.serviceName}: {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          {!isChecking && (
            <Button onClick={runCheck}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              {hasChecked ? 'Run Again' : 'Run Breach Check'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
