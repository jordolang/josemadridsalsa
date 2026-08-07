'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { NotificationSeverity } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface NotificationRow {
  id: string
  type: string
  severity: NotificationSeverity
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

const SEVERITY_STYLES: Record<NotificationSeverity, string> = {
  CRITICAL: 'border-l-destructive',
  WARNING: 'border-l-amber-500',
  INFO: 'border-l-muted-foreground/40',
}

const formatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  const unread = notifications.filter((n) => !n.isRead)

  async function mark(id?: string) {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {}),
      })
      if (!response.ok) {
        toast.error('Could not update notifications')
        return
      }
      router.refresh()
    } catch {
      toast.error('Could not update notifications')
    } finally {
      setIsSaving(false)
    }
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nothing to report.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {unread.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => mark()} disabled={isSaving}>
            <CheckCheck className="mr-2 size-4" />
            Mark all read ({unread.length})
          </Button>
        </div>
      )}

      {notifications.map((notification) => {
        const body = (
          <Card
            className={cn(
              'border-l-4 transition-colors',
              SEVERITY_STYLES[notification.severity],
              notification.isRead ? 'opacity-60' : 'bg-muted/30',
              notification.link && 'hover:border-primary/50'
            )}
          >
            <CardContent className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-medium">{notification.title}</p>
                  {!notification.isRead && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
                      new
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatter.format(new Date(notification.createdAt))}
                </p>
              </div>
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={(e) => {
                    // The card is a link; marking read should not also navigate.
                    e.preventDefault()
                    e.stopPropagation()
                    mark(notification.id)
                  }}
                >
                  Mark read
                </Button>
              )}
            </CardContent>
          </Card>
        )

        return notification.link ? (
          <Link key={notification.id} href={notification.link} className="block">
            {body}
          </Link>
        ) : (
          <div key={notification.id}>{body}</div>
        )
      })}
    </div>
  )
}
