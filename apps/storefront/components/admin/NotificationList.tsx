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
import type { EmailAlertDetails } from '@/lib/inbox/alert-card'
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
  /** Set on customer-email alerts, which get their own structured layout. */
  email?: EmailAlertDetails | null
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

function EmailAlertBody({
  notification,
  email,
}: {
  notification: NotificationRow
  email: EmailAlertDetails
}) {
  const heading = (
    <p className="text-sm font-bold uppercase tracking-wide">{email.heading}</p>
  )

  return (
    <div className="min-w-0 space-y-3 text-sm">
      {notification.link ? (
        <Link href={notification.link} className="block hover:underline">
          {heading}
        </Link>
      ) : (
        heading
      )}

      <div>
        <p className="font-bold">Email information</p>
        <p className="font-semibold break-words">From: {email.from}</p>
        <p className="font-semibold break-words">Subject: {email.subject}</p>
      </div>

      <div>
        <p className="font-bold">Notification information</p>
        {email.summary && <p className="text-muted-foreground">{email.summary}</p>}
        {email.steps.length > 0 ? (
          <>
            <p className="text-muted-foreground">To clear, the following must be performed:</p>
            <ol className="mt-1 space-y-0.5 pl-4">
              {email.steps.map((step, index) => (
                <li
                  key={index}
                  className={cn(step.done && 'text-muted-foreground line-through')}
                >
                  <span className="font-medium">Step {index + 1}</span> — {step.instruction}
                  {step.isOptional && ' (optional)'}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-muted-foreground">Nothing to do. Mark it read to clear it.</p>
        )}
      </div>

      <p className="break-all">
        <span className="font-medium">Read the thread in Gmail: </span>
        <a
          href={email.gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {email.gmailUrl}
        </a>
      </p>

      <p className="text-xs text-muted-foreground">
        {[
          formatter.format(new Date(notification.createdAt)),
          notification.isRead ? null : 'New Alert',
          email.classification,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  )
}

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
              {notification.email ? (
                <EmailAlertBody notification={notification} email={notification.email} />
              ) : (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {!notification.isRead && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
                        new
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatter.format(new Date(notification.createdAt))}
                  </p>
                </div>
              )}
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

        // An email card links its heading instead: it carries its own Gmail link, and a link
        // cannot sit inside another.
        return notification.link && !notification.email ? (
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
