'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { MailingList } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Users, Upload } from 'lucide-react'
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
import { ConstantContactImportModal } from './ConstantContactImportModal'

type ListWithStats = MailingList & {
  _count: {
    subscribers: number
  }
}

export function ListsTable({ lists }: { lists: ListWithStats[] }) {
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCcImportOpen, setIsCcImportOpen] = useState(false)

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
      <div className="mb-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
        <h2 className="text-xl font-semibold">Existing Lists</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCcImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import from Constant Contact
          </Button>
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
      </div>

      <ConstantContactImportModal
        lists={lists.map((l) => ({ id: l.id, name: l.name }))}
        open={isCcImportOpen}
        onClose={() => setIsCcImportOpen(false)}
        onSuccess={() => window.location.reload()}
      />

      {lists.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No mailing lists found. Create your first list to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Active Subscribers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((list) => (
                <TableRow key={list.id}>
                  <TableCell className="font-medium">{list.name}</TableCell>
                  <TableCell className="text-muted-foreground">{list.description || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {list._count.subscribers}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
