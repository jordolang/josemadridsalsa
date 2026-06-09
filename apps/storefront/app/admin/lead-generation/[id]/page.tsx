import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { CampaignDetailClient } from './campaign-detail-client';

export default async function CampaignDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const campaign = await prisma.leadCampaign.findUnique({
    where: { id },
    include: {
      template: true,
      leads: {
        orderBy: { createdAt: 'desc' },
        take: 100
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
          {campaign.city}, {campaign.state}
          {campaign.district ? ` (${campaign.district})` : ''}
          {campaign.leadType === 'LOCAL_BUSINESS' && campaign.businessCategory
            ? ` - ${campaign.businessCategory}`
            : ''}
          {campaign.leadType !== 'LOCAL_BUSINESS' && campaign.schoolType
            ? ` - ${campaign.schoolType}`
            : ''}
          {' '}(Limit: {campaign.limit})
        </p>
      </div>

      <CampaignDetailClient campaign={campaign} />
    </div>
  );
}
