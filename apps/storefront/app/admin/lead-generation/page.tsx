import { prisma } from '@/lib/prisma'
import { CreateCampaignDialog } from './create-campaign-dialog'
import { CampaignGrid } from './campaign-grid'

export default async function LeadGenerationDashboard() {
  const campaigns = await prisma.leadCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      leadType: true,
      status: true,
      totalFound: true,
      totalEmailsFound: true,
      totalSent: true,
      createdAt: true,
    },
  })

  const serialized = campaigns.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Generation</h1>
          <p className="text-sm text-muted-foreground">
            Scrape Google Maps and find contacts for outreach campaigns.
          </p>
        </div>
        <CreateCampaignDialog />
      </div>

      <CampaignGrid campaigns={serialized} />
    </div>
  )
}
