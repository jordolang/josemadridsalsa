'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, ExternalLink, Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { statusBadge } from '@/components/admin/cms/status'

export interface AdminPollRow {
  id: string
  slug: string
  title: string
  status: string
  visibility: string
  featured: boolean
  responseCount: number
  questionCount: number
  updatedAt: string
}

/** Turns a title into the slug the poll's public URL uses. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/**
 * The polls table on /admin/content/polls.
 *
 * Creating a poll here only asks for a title: the new poll opens straight into
 * the editor, where the questions and everything else live.
 */
export function PollList({ polls }: { polls: AdminPollRow[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AdminPollRow | null>(null)

  async function create() {
    const finalSlug = slug.trim() || slugify(title)
    if (!title.trim() || !finalSlug) {
      toast.error('A title is needed to start a poll')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/admin/cms/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slug: finalSlug }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not create the poll')
      toast.success('Poll created')
      router.push(`/admin/content/polls/${payload.poll.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the poll')
    } finally {
      setBusy(false)
    }
  }

  async function remove(poll: AdminPollRow) {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/cms/polls/${poll.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Could not delete the poll')
      }
      toast.success('Poll deleted')
      setPendingDelete(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the poll')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Polls</h2>
          <p className="text-sm text-muted-foreground">
            Every poll on the site. Public polls are listed on /polls; invite-only polls are reachable
            only through their share link.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New poll
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Who can see it</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead className="text-right">Responses</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {polls.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No polls yet. Create the first one.
                </TableCell>
              </TableRow>
            )}
            {polls.map((poll) => (
              <TableRow key={poll.id}>
                <TableCell>
                  <Link
                    href={`/admin/content/polls/${poll.id}`}
                    className="font-medium hover:underline"
                  >
                    {poll.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">/polls/{poll.slug}</p>
                </TableCell>
                <TableCell>{statusBadge({ status: poll.status })}</TableCell>
                <TableCell>
                  {poll.visibility === 'INVITE_ONLY' ? (
                    <Badge variant="secondary">
                      <Lock className="mr-1 h-3 w-3" />
                      Invite only
                    </Badge>
                  ) : (
                    <Badge variant="outline">Everyone</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{poll.questionCount}</TableCell>
                <TableCell className="text-right tabular-nums">{poll.responseCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" title="Results">
                      <Link href={`/admin/content/polls/${poll.id}#responses`}>
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="icon" title="View on the site">
                      <Link href={`/polls/${poll.slug}`} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => setPendingDelete(poll)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New poll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="poll-title">Title</Label>
              <Input
                id="poll-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setSlug(slugify(event.target.value))
                }}
                placeholder="Which new flavour should we make next?"
              />
            </div>
            <div>
              <Label htmlFor="poll-slug">URL</Label>
              <Input
                id="poll-slug"
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                placeholder="which-flavour-next"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The poll will live at /polls/{slug || 'your-url'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create and edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes the {pendingDelete?.responseCount ?? 0} response
              {pendingDelete?.responseCount === 1 ? '' : 's'} people have already sent. Export them
              first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove(pendingDelete)}
              disabled={busy}
            >
              Delete poll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
