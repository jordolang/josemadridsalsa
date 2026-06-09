import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Mail, Plus, Send, Clock, CheckCircle2, XCircle, Pause, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

async function getCampaigns() {
  const campaigns = await prisma.emailCampaign.findMany({
    include: {
      template: {
        select: {
          name: true,
        },
      },
      list: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          recipients: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return campaigns
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'DRAFT':
      return <Clock className="h-4 w-4 text-muted-foreground" />
    case 'SCHEDULED':
      return <Clock className="h-4 w-4 text-primary" />
    case 'SENDING':
      return <Send className="h-4 w-4 text-orange-500 animate-pulse" />
    case 'SENT':
      return <CheckCircle2 className="h-4 w-4 text-primary" />
    case 'PAUSED':
      return <Pause className="h-4 w-4 text-yellow-500" />
    case 'CANCELLED':
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-destructive" />
    default:
      return <Mail className="h-4 w-4 text-muted-foreground" />
  }
}

function getStatusBadge(status: string) {
  const baseClasses = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium'
  
  switch (status) {
    case 'DRAFT':
      return <span className={`${baseClasses} bg-muted text-foreground`}>Draft</span>
    case 'SCHEDULED':
      return <span className={`${baseClasses} bg-primary/10 text-primary`}>Scheduled</span>
    case 'SENDING':
      return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>Sending</span>
    case 'SENT':
      return <span className={`${baseClasses} bg-primary/10 text-primary`}>Sent</span>
    case 'PAUSED':
      return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Paused</span>
    case 'CANCELLED':
      return <span className={`${baseClasses} bg-muted text-foreground`}>Cancelled</span>
    case 'FAILED':
      return <span className={`${baseClasses} bg-destructive/10 text-destructive`}>Failed</span>
    default:
      return <span className={`${baseClasses} bg-muted text-foreground`}>{status}</span>
  }
}

export default async function EmailCampaignsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:read']))) {
    redirect('/admin')
  }

  const canWrite = await hasAnyPermission(user, ['content:write'])
  const campaigns = await getCampaigns()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Email Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Send mass emails and track campaign performance
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/admin/email-campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No campaigns yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started by creating your first email campaign.
            </p>
            {canWrite && (
              <Button asChild className="mt-4">
                <Link href="/admin/email-campaigns/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => {
            const progress = campaign.totalRecipients > 0
              ? (campaign.sentCount / campaign.totalRecipients) * 100
              : 0

            return (
              <Card key={campaign.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(campaign.status)}
                      <div>
                        <Link
                          href={`/admin/email-campaigns/${campaign.id}`}
                          className="text-lg font-semibold text-foreground hover:text-primary"
                        >
                          {campaign.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span>Template: {campaign.template.name}</span>
                      </div>
                      {campaign.list && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>List: {campaign.list.name}</span>
                        </div>
                      )}
                      <div>
                        Recipients: {campaign.totalRecipients.toLocaleString()}
                      </div>
                      {campaign.sentCount > 0 && (
                        <div className="text-primary">
                          Sent: {campaign.sentCount.toLocaleString()}
                        </div>
                      )}
                      {campaign.failedCount > 0 && (
                        <div className="text-destructive">
                          Failed: {campaign.failedCount.toLocaleString()}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Created {campaign.createdAt.toLocaleDateString()}
                      </div>
                    </div>

                    {campaign.status === 'SENDING' && campaign.totalRecipients > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    {getStatusBadge(campaign.status)}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
