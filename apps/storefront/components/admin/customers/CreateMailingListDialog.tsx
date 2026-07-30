'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CreateMailingListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tick-selected rows. When non-empty these win over the filters. */
  selectedIds: string[]
  totalMatching: number
  filters: {
    search?: string
    source?: string
    accountType?: string
  }
}

/**
 * Builds a mailing list from the customer list — either the ticked rows or
 * everything matching the current filters (not just the visible page).
 */
export function CreateMailingListDialog({
  open,
  onOpenChange,
  selectedIds,
  totalMatching,
  filters,
}: CreateMailingListDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const usingSelection = selectedIds.length > 0
  const count = usingSelection ? selectedIds.length : totalMatching

  async function create() {
    if (!name.trim()) {
      toast.error('Give the list a name')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/customers/mailing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          customerIds: usingSelection ? selectedIds : undefined,
          filters: usingSelection ? undefined : filters,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to create list')

      toast.success(
        `"${data.list.name}" created — ${data.added.toLocaleString()} contacts added` +
          (data.unsubscribed > 0
            ? `, ${data.unsubscribed.toLocaleString()} carried over as unsubscribed`
            : '')
      )
      onOpenChange(false)
      setName('')
      setDescription('')
      router.push(`/admin/communications/lists/${data.list.id}`)
    } catch (error) {
      console.error('Mailing list creation failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create list')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create mailing list</DialogTitle>
          <DialogDescription>
            {usingSelection
              ? `From the ${count.toLocaleString()} customer${count === 1 ? '' : 's'} you selected.`
              : `From all ${count.toLocaleString()} customers matching the current filters — every page, not just this one.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="listName">List name</Label>
            <Input
              id="listName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wholesale accounts 2026"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="listDescription">Description (optional)</Label>
            <Textarea
              id="listDescription"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Contacts who have unsubscribed are still added, but marked
            unsubscribed so campaigns skip them. Each contact is tagged with its
            account type and organization for segmenting later.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={create} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
