import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { CampaignManager } from './campaign-manager';
import { LeadsTable } from './leads-table';
import { ScraperMonitor } from './scraper-monitor';

export default async function CampaignDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id },
    include: {
      template: true,
      leads: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
        <p className="text-muted-foreground">
          {campaign.city}, {campaign.state} {campaign.district ? `(${campaign.district})` : ''} - {campaign.schoolType} (Limit: {campaign.limit})
        </p>
      </div>

      <CampaignManager campaign={campaign} />

      <ScraperMonitor campaignId={campaign.id} />

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Leads Found ({campaign.leads.length})</h2>
        <LeadsTable leads={campaign.leads} />
      </div>
    </div>
  );
}
