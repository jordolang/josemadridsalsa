import Link from 'next/link'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NEVER_AUTO_ANSWER, humaniseCategory } from '@/lib/inbox/policy'
import { ConnectGmailButton } from '@/components/admin/inbox/ConnectGmailButton'

export const metadata = { title: 'Customer Email Settings | Jose Madrid Salsa Admin' }
export const dynamic = 'force-dynamic'

export default async function InboxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'api_keys:manage'))) redirect('/admin')

    const [connection, params] = await Promise.all([
      prisma.gmailConnection.findFirst({ orderBy: { updatedAt: 'desc' } }),
      searchParams,
    ])

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Link href="/admin/inbox" className="text-sm text-muted-foreground hover:underline">
            ← Customer Email
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Customer Email Settings</h1>
        </div>

        {params.connected && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Connected {params.connected}. The next sweep runs within ten minutes.
          </p>
        )}
        {params.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{params.error}</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Mailbox</CardTitle>
            <CardDescription>
              The Gmail account the automation reads, labels and replies from.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connection?.isActive ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800">Connected</Badge>
                  <span className="text-sm font-medium">{connection.mailbox}</span>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Last swept</dt>
                    <dd>{connection.lastSweepAt?.toLocaleString('en-US') ?? 'Never'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Triaged on last sweep</dt>
                    <dd>{connection.lastSweepCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Auto-reply</dt>
                    <dd>
                      {connection.autoReplyEnabled
                        ? `On, at ${connection.autoReplyMinConfidence}% confidence or above`
                        : 'Off — replies are drafted only'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Gmail search</dt>
                    <dd className="font-mono text-xs">{connection.searchQuery}</dd>
                  </div>
                </dl>
                {connection.connectionError && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                    {connection.connectionError}
                  </p>
                )}
                <ConnectGmailButton label="Reconnect" />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No mailbox is connected, so no customer email is being read or answered.
                </p>
                <ConnectGmailButton label="Connect Gmail" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What is never answered automatically</CardTitle>
            <CardDescription>
              These always go to a person with a checklist, whatever the classifier thinks —
              the right reply commits the business to money or to a remedy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {NEVER_AUTO_ANSWER.map((category) => (
                <li key={category}>{humaniseCategory(category)}</li>
              ))}
              <li>Anything the classifier could not resolve from verified facts</li>
              <li>Any message naming an order the sender does not own</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('[Inbox] Error rendering settings:', error)
    throw new Error('Failed to load customer email settings')
  }
}
