import Link from 'next/link'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { humaniseCategory } from '@/lib/inbox/policy'
import { gmailThreadUrl } from '@/lib/inbox/gmail'
import { outstandingSteps } from '@/lib/inbox/resolution'

export const metadata = { title: 'Customer Email | Jose Madrid Salsa Admin' }
export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, string> = {
  NEEDS_ACTION: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  REPLY_DRAFTED: 'bg-blue-100 text-blue-800',
  AUTO_ANSWERED: 'bg-emerald-100 text-emerald-800',
  RESOLVED: 'bg-muted text-muted-foreground',
  IGNORED: 'bg-muted text-muted-foreground',
}

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default async function InboxPage() {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'messaging:read'))) redirect('/admin')

    const [connection, emails] = await Promise.all([
      prisma.gmailConnection.findFirst({ where: { isActive: true } }),
      prisma.inboundEmail.findMany({
        where: { status: { not: 'IGNORED' } },
        // Open work first, newest within each group — a worklist, not a log.
        orderBy: [{ resolvedAt: { sort: 'asc', nulls: 'first' } }, { receivedAt: 'desc' }],
        take: 100,
        include: { steps: { orderBy: { position: 'asc' } } },
      }),
    ])

    const open = emails.filter(
      (email) => email.status === 'NEEDS_ACTION' || email.status === 'IN_PROGRESS' || email.status === 'REPLY_DRAFTED',
    ).length

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer Email</h1>
            <p className="text-sm text-muted-foreground">
              {connection
                ? `Triaging ${connection.mailbox} — ${open === 0 ? 'nothing outstanding' : `${open} needing attention`}`
                : 'No mailbox connected yet.'}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/inbox/settings">Settings</Link>
          </Button>
        </div>

        {!connection && (
          <Card>
            <CardHeader>
              <CardTitle>Connect a mailbox</CardTitle>
              <CardDescription>
                Nothing is being read or answered until a Gmail account is connected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/inbox/settings">Connect Gmail</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open steps</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No customer email has been triaged yet.
                    </TableCell>
                  </TableRow>
                )}
                {emails.map((email) => {
                  const open = outstandingSteps(email.steps).length
                  return (
                    <TableRow key={email.id}>
                      <TableCell className="font-medium">
                        {email.fromName ?? email.fromEmail}
                        <div className="text-xs text-muted-foreground">{email.fromEmail}</div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <Link href={`/admin/inbox/${email.id}`} className="hover:underline">
                          {email.subject}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">{email.summary}</div>
                      </TableCell>
                      <TableCell className="text-sm">{humaniseCategory(email.category)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_TONE[email.status]}>
                          {statusLabel(email.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {open > 0 ? open : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {email.receivedAt.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        <div>
                          <a
                            href={gmailThreadUrl(email.gmailThreadId)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            Gmail ↗
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('[Inbox] Error rendering:', error)
    throw new Error('Failed to load the customer email inbox')
  }
}
