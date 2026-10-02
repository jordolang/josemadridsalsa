import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { gmailThreadUrl } from '@/lib/inbox/gmail'
import { humaniseCategory } from '@/lib/inbox/policy'
import { outstandingSteps } from '@/lib/inbox/resolution'
import { ReplyPreview, StepChecklist } from '@/components/admin/inbox/StepChecklist'

export const dynamic = 'force-dynamic'

export default async function InboxEmailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'messaging:read'))) redirect('/admin')

    const { id } = await params

    const email = await prisma.inboundEmail.findUnique({
      where: { id },
      include: { steps: { orderBy: { position: 'asc' } } },
    })
    if (!email) notFound()

    const canEdit = await hasPermission(user, 'messaging:reply')
    const open = outstandingSteps(email.steps).length

    const [order, customer] = await Promise.all([
      email.orderId
        ? prisma.order.findUnique({
            where: { id: email.orderId },
            select: { id: true, orderNumber: true, status: true, total: true },
          })
        : null,
      email.customerId
        ? prisma.customer.findUnique({
            where: { id: email.customerId },
            select: { id: true, firstName: true, lastName: true, email: true, totalOrders: true },
          })
        : null,
    ])

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Link href="/admin/inbox" className="text-sm text-muted-foreground hover:underline">
              ← Customer Email
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">{email.subject}</h1>
            <p className="text-sm text-muted-foreground">
              From {email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail} ·{' '}
              {email.receivedAt.toLocaleString('en-US')}
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={gmailThreadUrl(email.gmailThreadId)} target="_blank" rel="noreferrer">
              Open in Gmail ↗
            </a>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{humaniseCategory(email.category)}</Badge>
          <Badge variant="secondary">{email.severity}</Badge>
          <Badge variant="secondary">{email.confidence}% confidence</Badge>
          {email.autoReplySent && <Badge className="bg-emerald-100 text-emerald-800">Answered automatically</Badge>}
          {open > 0 && <Badge className="bg-red-100 text-red-800">{open} step{open === 1 ? '' : 's'} outstanding</Badge>}
          {email.resolvedAt && <Badge variant="secondary">Resolved</Badge>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What they want</CardTitle>
            <CardDescription>{email.summary}</CardDescription>
          </CardHeader>
          {email.actionSummary && (
            <CardContent>
              <p className="text-sm">{email.actionSummary}</p>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Before this alert can be cleared</CardTitle>
            <CardDescription>
              {open === 0
                ? 'Everything required has been done.'
                : 'The notification stays unread until every required step is ticked off.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StepChecklist
              emailId={email.id}
              canEdit={canEdit}
              steps={email.steps.map((step) => ({
                id: step.id,
                instruction: step.instruction,
                isOptional: step.isOptional,
                completedAt: step.completedAt?.toISOString() ?? null,
                note: step.note,
              }))}
            />
          </CardContent>
        </Card>

        {(email.autoReplyBody || email.draftedReply) && (
          <Card>
            <CardHeader>
              <CardTitle>{email.autoReplySent ? 'Sent reply' : 'Drafted reply'}</CardTitle>
              <CardDescription>
                {email.autoReplySent
                  ? `Sent ${email.autoReplyAt?.toLocaleString('en-US') ?? ''} in the Gmail thread.`
                  : 'Waiting in Gmail as a draft. Read it, change it if you need to, and send it from there.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReplyPreview
                body={(email.autoReplyBody ?? email.draftedReply)!}
                sent={email.autoReplySent}
              />
            </CardContent>
          </Card>
        )}

        {(order || customer) && (
          <Card>
            <CardHeader>
              <CardTitle>Linked records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {customer && (
                <p>
                  Customer:{' '}
                  <Link
                    href={`/admin/customers?search=${encodeURIComponent(customer.email)}`}
                    className="hover:underline"
                  >
                    {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || email.fromEmail}
                  </Link>{' '}
                  <span className="text-muted-foreground">({customer.totalOrders} orders)</span>
                </p>
              )}
              {order && (
                <p>
                  Order:{' '}
                  <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                    {order.orderNumber}
                  </Link>{' '}
                  <span className="text-muted-foreground">
                    {order.status} · ${String(order.total)}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>The message</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm">{email.body}</pre>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('[Inbox] Error rendering email:', error)
    throw new Error('Failed to load that email')
  }
}
