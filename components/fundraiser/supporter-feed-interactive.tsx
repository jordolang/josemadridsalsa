'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SupporterFeed, type SupporterFeedItem } from './supporter-feed'

interface SupporterFeedInteractiveProps {
  items: SupporterFeedItem[]
  initialLovedIds?: string[]
  currentUserName?: string | null
}

export function SupporterFeedInteractive({
  items: initialItems,
  initialLovedIds = [],
  currentUserName,
}: SupporterFeedInteractiveProps) {
  const [items, setItems] = useState(initialItems)
  const [lovedIds, setLovedIds] = useState<Set<string>>(
    () => new Set(initialLovedIds),
  )
  const [, startTransition] = useTransition()

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

  const handleComment = () => {
    toast.info('Replies coming soon — admins can reply via the admin panel.')
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
    <SupporterFeed
      items={items}
      onLove={handleLove}
      onComment={handleComment}
      onShare={handleShare}
    />
  )
}
