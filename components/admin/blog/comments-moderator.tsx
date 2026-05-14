'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  EyeOff,
  Trash2,
  AlertOctagon,
  ExternalLink,
  Reply,
  Loader2,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Status = 'PENDING' | 'APPROVED' | 'HIDDEN' | 'SPAM'

interface CommentRow {
  id: string
  postId: string
  body: string
  status: Status
  parentId: string | null
  createdAt: string
  user: { name: string | null; email: string }
  post: { slug: string; title: string }
}

interface CommentsModeratorProps {
  initial: CommentRow[]
}

export function CommentsModerator({ initial }: CommentsModeratorProps) {
  const router = useRouter()
  const [working, setWorking] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)

  async function setStatus(id: string, status: Status) {
    setWorking(id)
    try {
      const res = await fetch(`/api/heat-index/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed')
      }
      toast.success(`Comment ${status.toLowerCase()}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setWorking(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Permanently delete this comment?')) return
    setWorking(id)
    try {
      const res = await fetch(`/api/heat-index/comments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed')
      }
      toast.success('Comment deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setWorking(null)
    }
  }

  async function sendReply(parent: CommentRow) {
    if (!replyBody.trim()) return
    setReplying(true)
    try {
      const res = await fetch('/api/admin/heat-index/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: parent.postId,
          parentId: parent.parentId ? null : parent.id,
          body: replyBody.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Reply failed')
      toast.success('Reply posted')
      setReplyOpen(null)
      setReplyBody('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reply failed')
    } finally {
      setReplying(false)
    }
  }

  if (initial.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="text-muted-foreground">Nothing to moderate. Inbox clear.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {initial.map((c) => (
        <li key={c.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
            <span className="font-semibold">{c.user.name ?? c.user.email}</span>
            <span className="text-xs text-muted-foreground">{c.user.email}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(c.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {c.parentId && (
              <span className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                Reply
              </span>
            )}
            <span
              className={`ml-auto text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 ${
                c.status === 'PENDING'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : c.status === 'APPROVED'
                    ? 'bg-verde-100 text-verde-800 dark:bg-verde-900/40 dark:text-verde-200'
                    : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {c.status}
            </span>
          </div>
          <p className="text-foreground whitespace-pre-wrap leading-relaxed mb-3">{c.body}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/heat-index/${c.post.slug}#comments`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {c.post.title}
            </Link>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {c.status !== 'APPROVED' && (
                <Button
                  size="sm"
                  onClick={() => setStatus(c.id, 'APPROVED')}
                  disabled={working === c.id}
                  className="bg-verde-600 hover:bg-verde-700 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Approve
                </Button>
              )}
              {c.status === 'APPROVED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReplyOpen(replyOpen === c.id ? null : c.id)
                    setReplyBody('')
                  }}
                  disabled={working === c.id}
                >
                  <Reply className="w-3.5 h-3.5 mr-1.5" />
                  {replyOpen === c.id ? 'Cancel' : 'Reply'}
                </Button>
              )}
              {c.status !== 'HIDDEN' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(c.id, 'HIDDEN')}
                  disabled={working === c.id}
                >
                  <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                  Hide
                </Button>
              )}
              {c.status !== 'SPAM' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(c.id, 'SPAM')}
                  disabled={working === c.id}
                >
                  <AlertOctagon className="w-3.5 h-3.5 mr-1.5" />
                  Spam
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(c.id)}
                disabled={working === c.id}
                className="text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {replyOpen === c.id && (
            <div className="mt-4 rounded-xl border border-salsa-200 bg-salsa-50/50 dark:border-salsa-900/40 dark:bg-salsa-950/20 p-4">
              <p className="text-xs text-muted-foreground mb-2">
                Replying publicly as the Jose Madrid Salsa team. Your reply will appear under this
                comment, auto-approved.
              </p>
              <Textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={3}
                placeholder="Write a reply…"
                disabled={replying}
                className="mb-2"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReplyOpen(null)
                    setReplyBody('')
                  }}
                  disabled={replying}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => sendReply(c)}
                  disabled={replying || !replyBody.trim()}
                  className="bg-salsa-600 hover:bg-salsa-700 text-white"
                >
                  {replying ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Post reply
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
