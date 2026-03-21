'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { MailingList } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createMailingList, deleteMailingList } from '../actions'

type ListWithStats = MailingList & {
  _count: {
    subscribers: number
  }
}

export function ListsTable({ lists }: { lists: ListWithStats[] }) {
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleCreate = async (formData: FormData) => {
    startTransition(async () => {
      try {
        await createMailingList(formData)
        setIsDialogOpen(false)
      } catch (error) {
        console.error('Failed to create list', error)
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this list?')) return
    startTransition(async () => {
      try {
        await deleteMailingList(id)
      } catch (error) {
        console.error('Failed to delete list', error)
      }
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-col items-center justify-between sm:flex-row">
        <h2 className="text-xl font-semibold">Existing Lists</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New List</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mailing List</DialogTitle>
              <DialogDescription>
                Add a new mailing list to segment your subscribers.
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreate}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">List Name</Label>
                  <Input id="name" name="name" required placeholder="e.g., Spring Newsletter" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea id="description" name="description" placeholder="Internal description of the list's purpose" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Creating...' : 'Create List'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No mailing lists found. Create your first list to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-4 text-left font-medium">Name</th>
                <th className="p-4 text-left font-medium">Description</th>
                <th className="p-4 text-left font-medium">Active Subscribers</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-4 font-medium">{list.name}</td>
                  <td className="p-4 text-muted-foreground">{list.description || '-'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {list._count.subscribers}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/communications/lists/${list.id}`}>
                          Manage Subscribers
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(list.id)}
                        disabled={isPending}
                      >
                        <span className="sr-only">Delete</span>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
