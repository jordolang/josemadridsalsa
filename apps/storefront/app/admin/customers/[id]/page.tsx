import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AddAccountNote, DeleteAccountNote } from '@/components/admin/customers/AccountNotes'
import {
  getCustomerTimeline,
  gmailQueryForAddress,
  type TimelineKind,
} from '@/lib/customers/communications'
import { getGmailAccessToken, getGmailConnection, gmailThreadUrl } from '@/lib/inbox/gmail'
import { listThreads } from '@/lib/inbox/mailbox'
import { MAILBOX_PERMISSION } from '@/lib/inbox/mailbox-session'

export const metadata = { title: 'Customer Account | Jose Madrid Salsa Admin' }
export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<TimelineKind, string> = {
  order: 'Order',
  fundraiser: 'Fundraiser',
  email_in: 'Email in',
  email_out: 'Email out',
  contact_form: 'Contact form',
  message: 'Message',
  live_chat: 'Live chat',
  note: 'Note',
}

const KIND_TONE: Record<TimelineKind, string> = {
  order: 'bg-emerald-100 text-emerald-800',
  fundraiser: 'bg-purple-100 text-purple-800',
  email_in: 'bg-blue-100 text-blue-800',
  email_out: 'bg-sky-100 text-sky-800',
  contact_form: 'bg-amber-100 text-amber-800',
  message: 'bg-amber-100 text-amber-800',
  live_chat: 'bg-amber-100 text-amber-800',
  note: 'bg-yellow-100 text-yellow-900',
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  FUNDRAISING: 'Fundraising',
  WHOLESALE: 'Wholesale',
}

function formatWhen(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Every Gmail thread with this address, read live — including replies typed in Gmail itself. */
async function MailboxThreads({ email }: { email: string }) {
  const connection = await getGmailConnection()
  if (!connection) {
    return (
      <p className="text-sm text-muted-foreground">
        No mailbox is connected.{' '}
        <Link href="/admin/inbox/settings" className="underline">
          Connect Gmail
        </Link>{' '}
        to see every email thread with this customer here.
      </p>
    )
  }

  try {
    const accessToken = await getGmailAccessToken(connection)
    const { threads } = await listThreads(accessToken, { q: gmailQueryForAddress(email), max: 20 })

    if (threads.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No email threads with {email} in {connection.mailbox}.
        </p>
      )
    }

    return (
      <ul className="divide-y">
        {threads.map((thread) => (
          <li key={thread.id} className="flex items-start justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {thread.subject}
                {thread.messageCount > 1 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {thread.messageCount} messages
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {thread.from} · {thread.snippet}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              <span>{formatWhen(new Date(thread.date))}</span>
              <a href={gmailThreadUrl(thread.id)} target="_blank" rel="noreferrer" className="underline">
                Open ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    )
  } catch (error) {
    console.warn('[customers] Could not read Gmail threads for', email, error)
    return (
      <p className="text-sm text-muted-foreground">Gmail could not be read just now. Try reloading the page.</p>
    )
  }
}

export default async function CustomerAccountPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'users:read'))) redirect('/admin')

    const { id } = await params
    const customer = await prisma.customer.findUnique({ where: { id } })
    if (!customer) notFound()

    const [canWrite, canReadMailbox, timeline] = await Promise.all([
      hasPermission(user, 'users:write'),
      hasPermission(user, MAILBOX_PERMISSION),
      getCustomerTimeline(customer),
    ])

    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email
    const orderCount = timeline.filter((entry) => entry.kind === 'order').length
    const emailCount = timeline.filter(
      (entry) => entry.kind === 'email_in' || entry.kind === 'email_out',
    ).length

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Link href="/admin/customers" className="text-sm text-muted-foreground hover:underline">
            ← Customers
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <Badge variant="secondary">
              {ACCOUNT_TYPE_LABELS[customer.accountType] ?? customer.accountType}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <a href={`mailto:${customer.email}`} className="hover:underline">
              {customer.email}
            </a>
            {customer.phone && <> · {customer.phone}</>} · Customer since{' '}
            {customer.createdAt.toLocaleDateString('en-US')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Orders</CardDescription>
              <CardTitle className="text-2xl">{orderCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Emails on file</CardDescription>
              <CardTitle className="text-2xl">{emailCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last activity</CardDescription>
              <CardTitle className="text-2xl">
                {timeline[0] ? timeline[0].at.toLocaleDateString('en-US') : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {customer.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Account summary</CardTitle>
              <CardDescription>The standing note from the customer list. Edit it there.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{customer.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>
              Orders, fundraisers, emails in and out, messages, chats and notes for this account, newest
              first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {canWrite && <AddAccountNote customerId={customer.id} />}

            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded for this account yet.</p>
            ) : (
              <ol className="space-y-4 border-l pl-4">
                {timeline.map((entry) => (
                  <li key={entry.key} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border bg-background" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`${KIND_TONE[entry.kind]} px-1.5 py-0 text-[11px] font-normal`}>
                        {KIND_LABEL[entry.kind]}
                      </Badge>
                      {entry.href ? (
                        <Link href={entry.href} className="text-sm font-medium hover:underline">
                          {entry.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{entry.title}</span>
                      )}
                      {entry.badge && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal">
                          {entry.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatWhen(entry.at)}
                      {entry.author && <> · {entry.author}</>}
                      {entry.kind === 'note' && canWrite && entry.id && (
                        <>
                          {' · '}
                          <DeleteAccountNote customerId={customer.id} noteId={entry.id} />
                        </>
                      )}
                    </p>
                    {entry.detail && (
                      <p
                        className={
                          entry.kind === 'note'
                            ? 'mt-1 whitespace-pre-wrap text-sm'
                            : 'mt-1 text-sm text-muted-foreground'
                        }
                      >
                        {entry.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {canReadMailbox && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Gmail threads</CardTitle>
                <CardDescription>
                  Every thread in the business mailbox with this address, including replies written in Gmail.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(
                    gmailQueryForAddress(customer.email),
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Search in Gmail ↗
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <MailboxThreads email={customer.email} />
              </Suspense>
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('[Customers] Error rendering account:', error)
    throw new Error('Failed to load that customer')
  }
}
