'use client'

import { useState, useTransition } from 'react'
import { MailingListSubscriber, SubscriberStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2 } from 'lucide-react'
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

interface SubscribersTableProps {
  listId: string
  subscribers: MailingListSubscriber[]
}

const statusColors: Record<SubscriberStatus, string> = {
  SUBSCRIBED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  UNSUBSCRIBED: 'text-slate-700 bg-slate-50 border-slate-200',
  BOUNCED: 'text-red-700 bg-red-50 border-red-200',
  COMPLAINED: 'text-amber-700 bg-amber-50 border-amber-200',
}

export function SubscribersTable({ listId, subscribers }: SubscribersTableProps) {
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await addSubscriber(listId, formData)
        setIsDialogOpen(false)
      } catch (err: any) {
        setError(err.message || 'An error occurred')
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {subscribers.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No subscribers yet. Add one manually to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Name</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">Joined</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((subscriber) => (
                <tr key={subscriber.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-4 font-medium">{subscriber.email}</td>
                  <td className="p-4 text-muted-foreground">{[subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ') || '-'}</td>
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
    </div>
  )
}
