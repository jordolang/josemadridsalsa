'use client'

import { useState, useTransition } from 'react'
import { MailingListSubscriber, SubscriberStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  SUBSCRIBED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  UNSUBSCRIBED: 'text-slate-700 bg-slate-50 border-slate-200',
  BOUNCED: 'text-red-700 bg-red-50 border-red-200',
  COMPLAINED: 'text-amber-700 bg-amber-50 border-amber-200',
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
        window.location.reload()
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
                {error && <div className="text-sm font-medium text-red-500">{error}</div>}
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
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 flex-wrap">
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
          {bulkError && <p className="text-xs text-red-600 w-full mt-1">{bulkError}</p>}
        </div>
      )}

      {subscribers.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No subscribers yet. Add one manually or import a CSV to get started.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-4 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Name</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">Joined</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((subscriber) => (
                <tr
                  key={subscriber.id}
                  className={`border-b last:border-0 hover:bg-muted/50 ${selected.has(subscriber.id) ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="p-4">
                    <Checkbox
                      checked={selected.has(subscriber.id)}
                      onCheckedChange={() => toggleOne(subscriber.id)}
                      aria-label={`Select ${subscriber.email}`}
                    />
                  </td>
                  <td className="p-4 font-medium">{subscriber.email}</td>
                  <td className="p-4 text-muted-foreground">
                    {[subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') || '-'}
                  </td>
                  <td className="p-4">
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
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(subscriber.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CsvImportModal
        listId={listId}
        listName={listName}
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </div>
  )
}

