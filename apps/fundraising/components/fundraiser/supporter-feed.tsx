'use client'

import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export type SupporterFeedItem = {
  id: string
  name: string
  avatarUrl?: string | null
  amount: number
  /** ISO 8601 timestamp. */
  createdAt: string
  comment?: string
  /** Display-only: how many users have "loved" this donation. */
  lovesCount?: number
  /** Display-only: up to 3 names/initials to render under the action row. */
  recentLovers?: string[]
  /** Display-only: the organizer's reply, if any. */
  reply?: { authorName: string; body: string; createdAt: string }
  /** Inline media attachment (still frame or poster for video). */
  media?: { type: 'image' | 'video'; url: string; alt?: string }
}

export interface SupporterFeedProps {
  items: SupporterFeedItem[]
  currency?: string
  className?: string
  /** Hook for the heart button. If omitted the button is display-only. */
  onLove?: (itemId: string) => void
  /** Hook for the comment button. */
  onComment?: (itemId: string) => void
  /** Hook for the share button. */
  onShare?: (itemId: string) => void
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Math.floor((now - then) / 1000))
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86_400)}d ago`
}

/**
 * Vertical feed of donor activity. Each card shows avatar, name, donation
 * amount, timestamp, optional comment, and Love/Comment/Share actions.
 *
 * Actions are passed in as callbacks; omit them for a purely read-only
 * display.
 */
export function SupporterFeed({
  items,
  currency = 'USD',
  className,
  onLove,
  onComment,
  onShare,
}: SupporterFeedProps) {
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {items.map((item) => (
        <Card
          key={item.id}
          className="rounded-2xl border-slate-200/60 bg-white shadow-sm"
        >
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                {item.avatarUrl && (
                  <AvatarImage src={item.avatarUrl} alt={item.name} />
                )}
                <AvatarFallback>{initials(item.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      made a donation of{' '}
                    </span>
                    <span className="font-semibold text-foreground">
                      {fmt.format(item.amount)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="More options"
                    className="h-7 w-7 shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {relativeTime(item.createdAt)}
                </div>
              </div>
            </div>

            {item.comment && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {item.comment}
              </p>
            )}

            {item.media && (
              <div className="overflow-hidden rounded-md border">
                {item.media.type === 'image' ? (
                  <img
                    src={item.media.url}
                    alt={item.media.alt ?? ''}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={item.media.url}
                    className="h-40 w-full object-cover"
                    controls
                    preload="metadata"
                  />
                )}
              </div>
            )}

            <div className="flex items-center justify-around border-t pt-2 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLove ? () => onLove(item.id) : undefined}
                disabled={!onLove}
                className="gap-1.5"
              >
                <Heart className="h-4 w-4" />
                Love
                {typeof item.lovesCount === 'number' && item.lovesCount > 0 && (
                  <span className="tabular-nums">({item.lovesCount})</span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onComment ? () => onComment(item.id) : undefined}
                disabled={!onComment}
                className="gap-1.5"
              >
                <MessageCircle className="h-4 w-4" />
                Comment
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onShare ? () => onShare(item.id) : undefined}
                disabled={!onShare}
                className="gap-1.5"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>

            {item.recentLovers && item.recentLovers.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                <span>
                  {item.recentLovers.slice(0, 3).join(', ')}
                  {item.recentLovers.length > 3 &&
                    ` and ${item.recentLovers.length - 3} others`}
                </span>
              </div>
            )}

            {item.reply && (
              <div className="rounded-md bg-muted/40 p-3 text-xs">
                <span className="font-semibold">{item.reply.authorName}</span>{' '}
                <span>{item.reply.body}</span>
                <div className="mt-0.5 text-muted-foreground">
                  {relativeTime(item.reply.createdAt)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Be the first to support this campaign.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
