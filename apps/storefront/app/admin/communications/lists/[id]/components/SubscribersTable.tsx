'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MailingListSubscriber, SubscriberStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Upload, Download, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addSubscriber, removeSubscriber, updateSubscriberStatus } from '../actions'
import { CsvImportModal } from './CsvImportModal'

interface SubscribersTableProps {
  listId: string
  listName: string
  subscribers: MailingListSubscriber[]
}

const statusColors: Record<SubscriberStatus, string> = {
  SUBSCRIBED: 'text-primary bg-primary/5 border-border',
  UNSUBSCRIBED: 'text-foreground bg-muted/50 border-border',
  BOUNCED: 'text-destructive bg-destructive/10 border-destructive/30',
  COMPLAINED: 'text-muted-foreground bg-muted/50 border-border',
}

export function SubscribersTable({ listId, listName, subscribers }: SubscribersTableProps) {
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<SubscriberStatus>('UNSUBSCRIBED')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const router = useRouter()

  const allSelected = subscribers.length > 0 && selected.size === subscribers.length
  const someSelected = selected.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(subscribers.map((s) => s.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = async (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await addSubscriber(listId, formData)
        setIsDialogOpen(false)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    })
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to permanently remove this subscriber?')) return
    startTransition(async () => {
      try {
        await removeSubscriber(id, listId)
      } catch (err) {
        console.error('Failed to remove subscriber', err)
      }
    })
  }

  const handleStatusChange = async (id: string, status: string) => {
    startTransition(async () => {
      try {
        await updateSubscriberStatus(id, listId, status as SubscriberStatus)
      } catch (err) {
        console.error('Failed to update status', err)
      }
    })
  }

  const handleExport = () => {
    window.location.href = `/api/admin/mailing-lists/${listId}/export`
  }

  const performBulkAction = async (action: string, extra?: Record<string, unknown>) => {
    setBulkActionLoading(true)
    setBulkError(null)
    try {
      const res = await fetch(`/api/admin/mailing-lists/${listId}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, subscriberIds: Array.from(selected), ...extra }),
      })
      const data = await res.json() as { error?: string; affected?: number }
      if (!res.ok) {
        setBulkError(data.error || 'Action failed')
      } else {
        setSelected(new Set())
        router.refresh()
      }
    } catch {
      setBulkError('Action failed')
    } finally {
      setBulkActionLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Subscriber</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Subscriber</DialogTitle>
              <DialogDescription>
                Manually add a new subscriber to this mailing list.
              </DialogDescription>
            </DialogHeader>
            <form action={handleAdd}>
              <div className="grid gap-4 py-4">
                {error && <div className="text-sm font-medium text-destructive">{error}</div>}
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" name="email" type="email" required placeholder="subscriber@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name (Optional)</Label>
                  <Input id="name" name="name" placeholder="John Doe" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Adding...' : 'Add Subscriber'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {someSelected && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-border flex-wrap">
          <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
          <div className="flex items-center gap-2 flex-wrap ml-2">
            <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as SubscriberStatus)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUBSCRIBED">SUBSCRIBED</SelectItem>
                <SelectItem value="UNSUBSCRIBED">UNSUBSCRIBED</SelectItem>
                <SelectItem value="BOUNCED">BOUNCED</SelectItem>
                <SelectItem value="COMPLAINED">COMPLAINED</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={bulkActionLoading}
              onClick={() => performBulkAction('updateStatus', { status: bulkStatus })}
            >
              Set Status
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={bulkActionLoading}
              onClick={() => performBulkAction('suppress')}
            >
              <ShieldAlert className="h-3 w-3 mr-1" />
              Suppress
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs"
              disabled={bulkActionLoading}
              onClick={() => {
                if (confirm(`Delete ${selected.size} subscriber(s)?`)) {
                  performBulkAction('delete')
                }
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              disabled={bulkActionLoading}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
          {bulkError && <p className="text-xs text-destructive w-full mt-1">{bulkError}</p>}
        </div>
      )}

      {subscribers.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No subscribers yet. Add one manually or import a CSV to get started.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((subscriber) => (
                <TableRow
                  key={subscriber.id}
                  className={selected.has(subscriber.id) ? 'bg-primary/5' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(subscriber.id)}
                      onCheckedChange={() => toggleOne(subscriber.id)}
                      aria-label={`Select ${subscriber.email}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{subscriber.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') || '-'}
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={subscriber.status}
                      disabled={isPending}
                      onValueChange={(val) => handleStatusChange(subscriber.id, val)}
                    >
                      <SelectTrigger className={`w-[140px] h-8 text-xs font-semibold ${statusColors[subscriber.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUBSCRIBED">SUBSCRIBED</SelectItem>
                        <SelectItem value="UNSUBSCRIBED">UNSUBSCRIBED</SelectItem>
                        <SelectItem value="BOUNCED">BOUNCED</SelectItem>
                        <SelectItem value="COMPLAINED">COMPLAINED</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(subscriber.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemove(subscriber.id)}
                      disabled={isPending}
                    >
                      <span className="sr-only">Remove</span>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CsvImportModal
        listId={listId}
        listName={listName}
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}

