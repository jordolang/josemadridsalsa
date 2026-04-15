'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  triggerGoogleSearchScraper,
  triggerWebsiteParser,
  triggerEmailSender,
  triggerFullAutomation,
  deleteLeadCampaign,
  saveCampaignTemplate,
} from '@/lib/actions/lead-generation'
import { useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { LeadCampaign, LeadEmailTemplate } from '@prisma/client'

type CampaignWithTemplate = LeadCampaign & {
  template: LeadEmailTemplate | null
}

const COMPLETED_STATUSES = ['COMPLETED', 'SCRAPE_COMPLETED', 'PARSING_COMPLETED']

function getLeadTypeLabels(leadType: string) {
  const isBusiness = leadType === 'LOCAL_BUSINESS'
  return {
    entityLabel: isBusiness ? 'Businesses' : 'Schools',
    searchStep: isBusiness ? '1. Search Businesses' : '1. Search Schools',
    defaultSubject: isBusiness
      ? 'Partnership opportunity for {{business_name}}'
      : 'Fundraising for {{school_name}} {{sport}}',
    defaultBody: isBusiness
      ? '<p>Hi {{contact_name}},</p>\n\n<p>I came across {{business_name}} and thought you might be interested in a partnership with Jose Madrid Salsa. We offer wholesale pricing and co-marketing opportunities.</p>\n\n<p>Best,<br/>Jose Madrid Salsa</p>'
      : '<p>Hi {{contact_name}},</p>\n\n<p>I noticed the {{school_name}} {{sport}} program might be looking for fundraising opportunities. We can help you raise money for {{sport_pitch}}.</p>\n\n<p>Best,<br/>Jose Madrid Salsa</p>',
    templateVars: isBusiness
      ? '{{business_name}}, {{contact_name}}, {{city}}, {{state}}, {{category}}'
      : '{{school_name}}, {{contact_name}}, {{sport}}, {{city}}, {{state}}, {{sport_pitch}}',
  }
}

export function CampaignManager({ campaign }: { campaign: CampaignWithTemplate }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const isActive = ['SCRAPING', 'PARSING_CONTACTS', 'SENDING_EMAILS'].includes(
    campaign.status
  )
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(interval)
  }, [isActive, router])

  const labels = getLeadTypeLabels(campaign.leadType)

  const handleAction = async (
    actionFn: (id: string) => Promise<unknown>,
    confirmMsg?: string
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    setLoading(true)
    try {
      await actionFn(campaign.id)
      router.refresh()
    } catch {
      alert('Action failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.'))
      return
    setLoading(true)
    try {
      await deleteLeadCampaign(campaign.id)
      router.push('/admin/lead-generation')
    } catch {
      setLoading(false)
    }
  }

  const onSaveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      await saveCampaignTemplate(campaign.id, {
        name: fd.get('name') as string,
        subject: fd.get('subject') as string,
        htmlContent: fd.get('htmlContent') as string,
      })
      router.refresh()
      alert('Template saved.')
    } catch {
      alert('Failed to save template.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Campaign Status</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {campaign.leadType.replace(/_/g, ' ')}
              </Badge>
              <Badge
                variant={
                  COMPLETED_STATUSES.includes(campaign.status) ? 'default' : 'secondary'
                }
              >
                {campaign.status}
              </Badge>
            </div>
          </div>
          <CardDescription>Metrics and current progress.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">
                {labels.entityLabel} Found:
              </span>
              <span className="font-medium">{campaign.totalFound}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Emails Parsed:</span>
              <span className="font-medium">{campaign.totalEmailsFound}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Emails Sent:</span>
              <span className="font-medium text-primary">{campaign.totalSent}</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-muted-foreground">Emails Failed:</span>
              <span className="font-medium text-destructive">
                {campaign.totalFailed}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction(triggerGoogleSearchScraper)}
            disabled={loading || campaign.status === 'SCRAPING'}
          >
            {labels.searchStep}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction(triggerWebsiteParser)}
            disabled={
              loading ||
              campaign.status === 'PARSING_CONTACTS' ||
              campaign.totalFound === 0
            }
          >
            2. Find Contacts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleAction(
                triggerEmailSender,
                'Are you sure you want to send emails? This cannot be undone.'
              )
            }
            disabled={
              loading ||
              campaign.status === 'SENDING_EMAILS' ||
              campaign.totalEmailsFound === 0 ||
              !campaign.templateId
            }
          >
            3. Send Emails
          </Button>
          <div className="w-full mt-2 space-y-2">
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() =>
                handleAction(
                  triggerFullAutomation,
                  'Start the entire automation process (Scrape -> Parse -> Send)?'
                )
              }
              disabled={loading || !campaign.templateId}
            >
              One-Click Scan & Send
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete Campaign
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Template</CardTitle>
          <CardDescription>
            Configure the email automatically sent to leads. Available variables:{' '}
            {labels.templateVars}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveTemplate} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                name="name"
                defaultValue={campaign.template?.name || 'Default Outreach'}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-subject">Email Subject</Label>
              <Input
                id="template-subject"
                name="subject"
                defaultValue={campaign.template?.subject || labels.defaultSubject}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-html">HTML Body</Label>
              <Textarea
                id="template-html"
                name="htmlContent"
                className="min-h-[200px] font-mono text-sm"
                defaultValue={campaign.template?.htmlContent || labels.defaultBody}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              Save Template
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
