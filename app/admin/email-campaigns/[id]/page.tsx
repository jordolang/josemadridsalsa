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
        <span className={`${baseClasses} bg-slate-100 text-slate-800`}>
          <Clock className="h-4 w-4" />
          Draft
        </span>
      )
    case 'SCHEDULED':
      return (
        <span className={`${baseClasses} bg-blue-100 text-blue-800`}>
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
        <span className={`${baseClasses} bg-green-100 text-green-800`}>
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
        <span className={`${baseClasses} bg-slate-100 text-slate-800`}>
          <XCircle className="h-4 w-4" />
          Cancelled
        </span>
      )
    case 'FAILED':
      return (
        <span className={`${baseClasses} bg-red-100 text-red-800`}>
          <XCircle className="h-4 w-4" />
          Failed
        </span>
      )
    default:
      return (
        <span className={`${baseClasses} bg-slate-100 text-slate-800`}>
          {status}
        </span>
      )
  }
}

function getRecipientStatusBadge(status: string) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'

  switch (status) {
    case 'PENDING':
      return <span className={`${base} bg-slate-100 text-slate-700`}>Pending</span>
    case 'SENDING':
      return <span className={`${base} bg-orange-100 text-orange-700`}>Sending</span>
    case 'SENT':
      return <span className={`${base} bg-green-100 text-green-700`}>Sent</span>
    case 'FAILED':
      return <span className={`${base} bg-red-100 text-red-700`}>Failed</span>
    case 'BOUNCED':
      return <span className={`${base} bg-yellow-100 text-yellow-700`}>Bounced</span>
    default:
      return <span className={`${base} bg-slate-100 text-slate-700`}>{status}</span>
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
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{campaign.name}</h1>
            {getStatusBadge(campaign.status)}
          </div>
          <p className="text-slate-600 mt-1">{campaign.subject}</p>
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
          <div className="text-sm text-slate-600">Total Recipients</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {campaign.totalRecipients.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600">Sent</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {campaign.sentCount.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600">Failed</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {campaign.failedCount.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-600">Pending</div>
          <div className="text-2xl font-bold text-slate-600 mt-1">
            {(statusCounts['PENDING'] || 0).toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Progress Bar (while sending) */}
      {campaign.status === 'SENDING' && campaign.totalRecipients > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600">Sending progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      )}

      {/* Campaign Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Campaign Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Template</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {campaign.template.name}{' '}
              <span className="text-slate-500">({campaign.template.category})</span>
            </dd>
          </div>
          {campaign.list && (
            <div>
              <dt className="text-slate-500">Mailing List</dt>
              <dd className="font-medium text-slate-900 mt-0.5">{campaign.list.name}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {campaign.createdAt.toLocaleString()}
            </dd>
          </div>
          {campaign.startedAt && (
            <div>
              <dt className="text-slate-500">Started</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {campaign.startedAt.toLocaleString()}
              </dd>
            </div>
          )}
          {campaign.completedAt && (
            <div>
              <dt className="text-slate-500">Completed</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {campaign.completedAt.toLocaleString()}
              </dd>
            </div>
          )}
          {campaign.scheduledAt && (
            <div>
              <dt className="text-slate-500">Scheduled For</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {campaign.scheduledAt.toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Recipients Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Recipients{' '}
            <span className="text-sm font-normal text-slate-500">
              (showing first 100)
            </span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status}>
                {status}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Email</th>
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Name</th>
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Status</th>
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Sent At</th>
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((recipient) => (
                <tr key={recipient.id} className="border-b border-slate-100">
                  <td className="py-2 px-3 font-mono text-xs">{recipient.email}</td>
                  <td className="py-2 px-3">{recipient.name || '-'}</td>
                  <td className="py-2 px-3">{getRecipientStatusBadge(recipient.status)}</td>
                  <td className="py-2 px-3 text-slate-500">
                    {recipient.sentAt ? recipient.sentAt.toLocaleString() : '-'}
                  </td>
                  <td className="py-2 px-3 text-red-600 text-xs max-w-[200px] truncate">
                    {recipient.errorMessage || '-'}
                  </td>
                </tr>
              ))}
              {campaign.recipients.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No recipients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
