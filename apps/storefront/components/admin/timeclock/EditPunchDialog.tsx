'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface EditPunchDialogProps {
  punchId: string
  employeeName: string
  /** Business-local `YYYY-MM-DDTHH:mm` values for the `datetime-local` inputs. */
  clockInAt: string
  clockOutAt: string | null
  notes: string | null
}

export default function EditPunchDialog({
  punchId,
  employeeName,
  clockInAt: initialClockIn,
  clockOutAt: initialClockOut,
  notes: initialNotes,
}: EditPunchDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clockInAt, setClockInAt] = useState(initialClockIn)
  const [clockOutAt, setClockOutAt] = useState(initialClockOut ?? '')
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/timeclock/${punchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clockInAt, clockOutAt, notes, reason }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to correct punch')
      }

      toast.success('Punch corrected', {
        description: `${employeeName}'s punch was updated and logged.`,
      })
      setOpen(false)
      setReason('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to correct punch')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Correct punch">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Correct Punch</DialogTitle>
            <DialogDescription>
              Times are Zanesville time. The change and your reason are saved to the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`clock-in-${punchId}`}>Clock in</Label>
                <Input
                  id={`clock-in-${punchId}`}
                  type="datetime-local"
                  value={clockInAt}
                  onChange={(e) => setClockInAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`clock-out-${punchId}`}>Clock out</Label>
                <Input
                  id={`clock-out-${punchId}`}
                  type="datetime-local"
                  value={clockOutAt}
                  onChange={(e) => setClockOutAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`notes-${punchId}`}>Job duties</Label>
              <Textarea
                id={`notes-${punchId}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`reason-${punchId}`}>Reason for correction</Label>
              <Input
                id={`reason-${punchId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Forgot to clock out"
                maxLength={500}
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save correction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
