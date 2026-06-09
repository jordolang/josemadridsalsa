'use client'

import { useState, useCallback } from 'react'
import { CampaignManager } from './campaign-manager'
import { LeadsTable } from './leads-table'
import { LiveLeadFeed } from './live-lead-feed'
import type { LeadCampaign, LeadEmailTemplate, Lead } from '@prisma/client'

type CampaignWithRelations = LeadCampaign & {
  template: LeadEmailTemplate | null
  leads: Lead[]
}

interface CampaignDetailClientProps {
  campaign: CampaignWithRelations
}

export function CampaignDetailClient({ campaign }: CampaignDetailClientProps) {
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(() =>
    campaign.leads.filter((l) => l.status === 'SCRAPED').map((l) => l.id)
  )

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedLeadIds(ids)
  }, [])

  return (
    <>
      <CampaignManager
        campaign={campaign}
        selectedLeadIds={selectedLeadIds}
        leads={campaign.leads}
      />

      <div className="mt-8">
        <LiveLeadFeed campaignId={campaign.id} />
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">
          All Leads ({campaign.leads.length})
        </h2>
        <LeadsTable
          leads={campaign.leads}
          leadType={campaign.leadType}
          campaignId={campaign.id}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </>
  )
}
