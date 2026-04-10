import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Users,
  Trash2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CampaignActions } from './_components/campaign-actions'

async function getCampaign(id: string) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          subject: true,
          category: true,
        },
      },
      list: {
        select: {
          id: true,
          name: true,
        },
      },
      recipients: {
        orderBy: { createdAt: 'asc' },
        take: 100,
      },
      stats: true,
    },
  })

  return campaign
}

async function getRecipientStatusCounts(campaignId: string) {
  const counts = await prisma.emailRecipient.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true,
  })

  return counts.reduce(
    (acc, curr) => {
      acc[curr.status] = curr._count
      return acc
    },
    {} as Record<string, number>
  )
}

function getStatusBadge(status: string) {
  const baseClasses =
    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium'

  switch (status) {
    case 'DRAFT':
      return (
        <span className={`${baseClasses} bg-muted text-foreground`}>
          <Clock className="h-4 w-4" />
          Draft
        </span>
      )
    case 'SCHEDULED':
      return (
        <span className={`${baseClasses} bg-primary/10 text-primary`}>
          <Clock className="h-4 w-4" />
          Scheduled
        </span>
      )
    case 'SENDING':
      return (
        <span className={`${baseClasses} bg-orange-100 text-orange-800`}>
          <Send className="h-4 w-4 animate-pulse" />
          Sending
        </span>
      )
    case 'SENT':
      return (
        <span className={`${baseClasses} bg-primary/10 text-primary`}>
          <CheckCircle2 className="h-4 w-4" />
          Sent
        </span>
      )
    case 'PAUSED':
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
          <Pause className="h-4 w-4" />
          Paused
        </span>
      )
    case 'CANCELLED':
      return (
        <span className={`${baseClasses} bg-muted text-foreground`}>
          <XCircle className="h-4 w-4" />
          Cancelled
        </span>
      )
    case 'FAILED':
      return (
        <span className={`${baseClasses} bg-destructive/10 text-destructive`}>
          <XCircle className="h-4 w-4" />
          Failed
        </span>
      )
    default:
      return (
        <span className={`${baseClasses} bg-muted text-foreground`}>
          {status}
        </span>
      )
  }
}

function getRecipientStatusBadge(status: string) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'

  switch (status) {
    case 'PENDING':
      return <span className={`${base} bg-muted text-foreground`}>Pending</span>
    case 'SENDING':
      return <span className={`${base} bg-orange-100 text-orange-700`}>Sending</span>
    case 'SENT':
      return <span className={`${base} bg-primary/10 text-primary`}>Sent</span>
    case 'FAILED':
      return <span className={`${base} bg-destructive/10 text-destructive`}>Failed</span>
    case 'BOUNCED':
      return <span className={`${base} bg-yellow-100 text-yellow-700`}>Bounced</span>
    default:
      return <span className={`${base} bg-muted text-foreground`}>{status}</span>
  }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:read']))) {
    redirect('/admin')
  }

  const canWrite = await hasAnyPermission(user, ['content:write'])
  const campaign = await getCampaign(id)

  if (!campaign) {
    notFound()
  }

  const statusCounts = await getRecipientStatusCounts(id)
  const progress =
    campaign.totalRecipients > 0
      ? (campaign.sentCount / campaign.totalRecipients) * 100
      : 0
  const failedCount = statusCounts['FAILED'] || 0

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/email-campaigns"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
            {getStatusBadge(campaign.status)}
          </div>
          <p className="text-muted-foreground mt-1">{campaign.subject}</p>
        </div>

        {canWrite && (
          <CampaignActions
            campaignId={campaign.id}
            status={campaign.status}
            failedCount={failedCount}
          />
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Recipients</div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {campaign.totalRecipients.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Sent</div>
          <div className="text-2xl font-bold text-primary mt-1">
            {campaign.sentCount.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Failed</div>
          <div className="text-2xl font-bold text-destructive mt-1">
            {campaign.failedCount.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-muted-foreground mt-1">
            {(statusCounts['PENDING'] || 0).toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Progress Bar (while sending) */}
      {campaign.status === 'SENDING' && campaign.totalRecipients > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Sending progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      )}

      {/* Campaign Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Campaign Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Template</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {campaign.template.name}{' '}
              <span className="text-muted-foreground">({campaign.template.category})</span>
            </dd>
          </div>
          {campaign.list && (
            <div>
              <dt className="text-muted-foreground">Mailing List</dt>
              <dd className="font-medium text-foreground mt-0.5">{campaign.list.name}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium text-foreground mt-0.5">
              {campaign.createdAt.toLocaleString()}
            </dd>
          </div>
          {campaign.startedAt && (
            <div>
              <dt className="text-muted-foreground">Started</dt>
              <dd className="font-medium text-foreground mt-0.5">
                {campaign.startedAt.toLocaleString()}
              </dd>
            </div>
          )}
          {campaign.completedAt && (
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="font-medium text-foreground mt-0.5">
                {campaign.completedAt.toLocaleString()}
              </dd>
            </div>
          )}
          {campaign.scheduledAt && (
            <div>
              <dt className="text-muted-foreground">Scheduled For</dt>
              <dd className="font-medium text-foreground mt-0.5">
                {campaign.scheduledAt.toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Recipients Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Recipients{' '}
            <span className="text-sm font-normal text-muted-foreground">
              (showing first 100)
            </span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status}>
                {status}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaign.recipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell className="font-mono text-xs">{recipient.email}</TableCell>
                  <TableCell>{recipient.name || '-'}</TableCell>
                  <TableCell>{getRecipientStatusBadge(recipient.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {recipient.sentAt ? recipient.sentAt.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                    {recipient.errorMessage || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {campaign.recipients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No recipients found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
