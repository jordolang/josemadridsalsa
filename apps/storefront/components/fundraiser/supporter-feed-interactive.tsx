'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SupporterFeed, type SupporterFeedItem } from './supporter-feed'

interface SupporterFeedInteractiveProps {
  items: SupporterFeedItem[]
  initialLovedIds?: string[]
  currentUserName?: string | null
  /** Staff (ADMIN/DEVELOPER/STAFF) may post the organizer reply; the API enforces it. */
  canReply?: boolean
}

export function SupporterFeedInteractive({
  items: initialItems,
  initialLovedIds = [],
  currentUserName,
  canReply = false,
}: SupporterFeedInteractiveProps) {
  const [items, setItems] = useState(initialItems)
  const [lovedIds, setLovedIds] = useState<Set<string>>(
    () => new Set(initialLovedIds),
  )
  const [, startTransition] = useTransition()
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const handleLove = (itemId: string) => {
    const isLoved = lovedIds.has(itemId)
    const method = isLoved ? 'DELETE' : 'POST'

    setLovedIds((prev) => {
      const next = new Set(prev)
      if (isLoved) next.delete(itemId)
      else next.add(itemId)
      return next
    })
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              lovesCount: Math.max(
                0,
                (item.lovesCount ?? 0) + (isLoved ? -1 : 1),
              ),
              recentLovers: isLoved
                ? (item.recentLovers ?? []).filter(
                    (n) => n !== currentUserName,
                  )
                : currentUserName
                  ? [currentUserName, ...(item.recentLovers ?? [])].slice(0, 3)
                  : (item.recentLovers ?? []),
            }
          : item,
      ),
    )

    startTransition(async () => {
      try {
        const res = await fetch(`/api/fundraiser/sale-events/${itemId}/love`, {
          method,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { lovesCount: number }
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, lovesCount: data.lovesCount }
              : item,
          ),
        )
      } catch (err) {
        setLovedIds((prev) => {
          const next = new Set(prev)
          if (isLoved) next.add(itemId)
          else next.delete(itemId)
          return next
        })
        setItems(initialItems)
        if (err instanceof Error && err.message.includes('401')) {
          toast.error('Sign in to love donations')
        } else {
          toast.error('Could not update love. Try again.')
        }
      }
    })
  }

  const handleComment = (itemId: string) => {
    setReplyBody('')
    setReplyingTo(itemId)
  }

  const submitReply = async () => {
    if (!replyingTo || !replyBody.trim()) return
    setSendingReply(true)
    try {
      const res = await fetch(`/api/fundraiser/sale-events/${replyingTo}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        reply?: { body: string; createdAt: string; author: { name: string | null } }
      }
      if (!res.ok || !data.reply) throw new Error(data.error ?? `HTTP ${res.status}`)
      const reply = data.reply
      setItems((prev) =>
        prev.map((item) =>
          item.id === replyingTo
            ? {
                ...item,
                reply: {
                  authorName: reply.author.name ?? 'Team',
                  body: reply.body,
                  createdAt: reply.createdAt,
                },
              }
            : item,
        ),
      )
      setReplyingTo(null)
      toast.success('Reply posted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post reply')
    } finally {
      setSendingReply(false)
    }
  }

  const handleShare = async (itemId: string) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}#donation-${itemId}`
        : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url })
        return
      } catch {
        // fall through to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    }
  }

  return (
    <>
      <SupporterFeed
        items={items}
        onLove={handleLove}
        onComment={canReply ? handleComment : undefined}
        onShare={handleShare}
      />
      <Dialog open={replyingTo !== null} onOpenChange={(open) => !open && setReplyingTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to supporter</DialogTitle>
          </DialogHeader>
          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Thank them for their support…"
            aria-label="Reply"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyingTo(null)}>
              Cancel
            </Button>
            <Button onClick={submitReply} disabled={sendingReply || !replyBody.trim()}>
              {sendingReply ? 'Posting…' : 'Post reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
