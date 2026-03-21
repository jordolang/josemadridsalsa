import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateCampaignDialog } from './create-campaign-dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export default async function LeadGenerationDashboard() {
  const campaigns = await prisma.leadCampaign.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Generation</h1>
          <p className="text-muted-foreground">Scrape Google Maps and find contacts for outreach campaigns.</p>
        </div>
        <CreateCampaignDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="truncate pr-2">{campaign.name}</CardTitle>
                <Badge variant={['COMPLETED', 'SCRAPE_COMPLETED', 'PARSING_COMPLETED'].includes(campaign.status) ? 'default' : 'secondary'}>{campaign.status}</Badge>
              </div>
              <CardDescription className="truncate">
                Searching: {campaign.city}, {campaign.state}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Found:</span>
                  <span className="font-medium">{campaign.totalFound} businesses</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contacts:</span>
                  <span className="font-medium">{campaign.totalEmailsFound} emails</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent:</span>
                  <span className="font-medium">{campaign.totalSent} emails</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{formatDistanceToNow(campaign.createdAt, { addSuffix: true })}</span>
                </div>
              </div>
              <div className="mt-4">
                <Link href={`/admin/lead-generation/${campaign.id}`}>
                  <Button className="w-full">Manage Campaign</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {campaigns.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            No campaigns found. Create one to start generating leads.
          </div>
        )}
      </div>
    </div>
  );
}
