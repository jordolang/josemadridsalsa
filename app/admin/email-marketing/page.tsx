import { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import { EmailDashboard } from './EmailDashboard'

export const metadata: Metadata = { title: 'Email Marketing Dashboard - Admin' }

export default async function EmailMarketingPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const since = subDays(new Date(), 30)

  // Wrap each query individually so a missing table or DB error doesn't crash the entire page
  const safeCount = async (fn: () => Promise<number>): Promise<number> => {
    try { return await fn() } catch { return 0 }
  }

  const [campaignCount, totalSubscribers, recentCampaigns, automationCount, suppressionCount] =
    await Promise.all([
      safeCount(() => prisma.emailCampaign.count({ where: { status: 'SENT', createdAt: { gte: since } } })),
      safeCount(() => prisma.mailingListSubscriber.count({ where: { status: 'SUBSCRIBED' } })),
      prisma.emailCampaign.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          sentCount: true,
          totalRecipients: true,
          createdAt: true,
          recipients: { select: { status: true } },
        },
      }).catch(() => []),
      safeCount(() => prisma.emailAutomation.count({ where: { isActive: true } })),
      safeCount(() => prisma.emailSuppression.count()),
    ])

  const campaignData = recentCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    sentCount: c.sentCount,
    totalRecipients: c.totalRecipients,
    openRate:
      c.sentCount > 0
        ? Math.round(
            (c.recipients.filter((r) => ['OPENED', 'CLICKED'].includes(r.status)).length /
              c.sentCount) *
              100
          )
        : 0,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Marketing</h1>
        <p className="text-muted-foreground">Overview of your email marketing performance</p>
      </div>
      <EmailDashboard
        stats={{
          campaigns: campaignCount,
          totalSubscribers,
          automationCount,
          suppressionCount,
        }}
        recentCampaigns={campaignData}
      />
    </div>
  )
}
