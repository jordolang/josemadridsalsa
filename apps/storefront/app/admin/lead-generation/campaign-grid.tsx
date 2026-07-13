'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDistanceToNow } from 'date-fns'

interface Campaign {
  id: string
  name: string
  city: string
  state: string
  leadType: string
  status: string
  totalFound: number
  totalEmailsFound: number
  totalSent: number
  createdAt: string
}

interface CampaignGridProps {
  campaigns: Campaign[]
}

type FilterTab = 'ALL' | 'SCHOOL_ATHLETICS' | 'LOCAL_BUSINESS' | 'LOCAL_SCHOOL' | 'FUNDRAISER_ORG'

const TAB_LABELS: Record<FilterTab, string> = {
  ALL: 'All',
  SCHOOL_ATHLETICS: 'School Athletics',
  LOCAL_BUSINESS: 'Local Businesses',
  LOCAL_SCHOOL: 'Local Schools',
  FUNDRAISER_ORG: 'Fundraiser Orgs',
}

const COMPLETED_STATUSES = ['COMPLETED', 'SCRAPE_COMPLETED', 'PARSING_COMPLETED']

function getEntityLabel(leadType: string): string {
  if (leadType === 'LOCAL_BUSINESS') return 'businesses'
  if (leadType === 'FUNDRAISER_ORG') return 'organizations'
  return 'schools'
}

export function CampaignGrid({ campaigns }: CampaignGridProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')

  const filtered = useMemo(
    () =>
      activeTab === 'ALL'
        ? campaigns
        : campaigns.filter((c) => c.leadType === activeTab),
    [campaigns, activeTab]
  )

  const stats = useMemo(() => {
    const compute = (list: Campaign[]) => ({
      count: list.length,
      totalFound: list.reduce((sum, c) => sum + c.totalFound, 0),
      totalEmails: list.reduce((sum, c) => sum + c.totalEmailsFound, 0),
      totalSent: list.reduce((sum, c) => sum + c.totalSent, 0),
    })
    return {
      all: compute(campaigns),
      current: compute(filtered),
    }
  }, [campaigns, filtered])

  return (
    <>
      {/* Filter Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FilterTab)}
      >
        <TabsList>
          {(Object.entries(TAB_LABELS) as [FilterTab, string][]).map(
            ([value, label]) => {
              const count =
                value === 'ALL'
                  ? campaigns.length
                  : campaigns.filter((c) => c.leadType === value).length
              return (
                <TabsTrigger key={value} value={value}>
                  {label} ({count})
                </TabsTrigger>
              )
            }
          )}
        </TabsList>
      </Tabs>

      {/* Aggregate Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Campaigns</p>
          <p className="text-2xl font-bold">{stats.current.count}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Found</p>
          <p className="text-2xl font-bold">
            {stats.current.totalFound.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Emails Found</p>
          <p className="text-2xl font-bold">
            {stats.current.totalEmails.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Emails Sent</p>
          <p className="text-2xl font-bold text-primary">
            {stats.current.totalSent.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Campaign Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((campaign) => (
          <Card key={campaign.id} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="truncate pr-2">{campaign.name}</CardTitle>
                <div className="flex gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {campaign.leadType.replace(/_/g, ' ')}
                  </Badge>
                  <Badge
                    variant={
                      COMPLETED_STATUSES.includes(campaign.status)
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {campaign.status}
                  </Badge>
                </div>
              </div>
              <CardDescription className="truncate">
                Searching: {campaign.city}, {campaign.state}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Found:</span>
                  <span className="font-medium">
                    {campaign.totalFound} {getEntityLabel(campaign.leadType)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contacts:</span>
                  <span className="font-medium">
                    {campaign.totalEmailsFound} emails
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent:</span>
                  <span className="font-medium">{campaign.totalSent} emails</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(campaign.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <Button asChild className="w-full">
                  <Link href={`/admin/lead-generation/${campaign.id}`}>
                    Manage Campaign
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-full border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No campaigns found. Create one to start generating leads.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
