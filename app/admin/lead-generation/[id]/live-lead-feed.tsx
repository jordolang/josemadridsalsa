'use client'

import { useScraperStream } from '@/hooks/use-scraper-stream'
import type { ScraperEvent } from '@/lib/scraper/event-bus'
import { useCallback, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Activity, Mail, Phone, TrendingUp } from 'lucide-react'

interface LiveLead {
  id: string
  schoolName: string
  schoolUrl: string
  email?: string
  phone?: string
  contactName?: string
  title?: string
  sport?: string
  status: string
  receivedAt: number
}

interface LiveLeadFeedProps {
  campaignId: string
}

export function LiveLeadFeed({ campaignId }: LiveLeadFeedProps) {
  const [leads, setLeads] = useState<LiveLead[]>([])
  const [stats, setStats] = useState({ total: 0, withEmail: 0, withPhone: 0 })
  const [scraperStatus, setScraperStatus] = useState<{
    active: boolean
    step?: string
    message?: string
  }>({ active: false })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchRecent() {
      try {
        const res = await fetch(
          `/api/admin/lead-generation/${campaignId}/leads?page=1&limit=20`
        )
        if (!res.ok || cancelled) return
        const body = await res.json()
        const fetched = body?.data?.leads
        if (!Array.isArray(fetched)) return
        setLeads(
          fetched.map((l) => ({
            id: l.id,
            schoolName: l.schoolName || l.businessName || 'Unnamed',
            schoolUrl: l.website || l.schoolUrl || '',
            email: l.email ?? undefined,
            phone: l.phone ?? undefined,
            contactName: l.contactName ?? undefined,
            title: l.title ?? undefined,
            sport: l.sport ?? undefined,
            status: l.status,
            receivedAt: new Date(l.createdAt).getTime(),
          }))
        )
        setStats({
          total: fetched.length,
          withEmail: fetched.filter((l) => l.email).length,
          withPhone: fetched.filter((l) => l.phone).length,
        })
      } catch {
        // ignore — SSE will populate over time
      }
    }
    fetchRecent()
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const handleEvent = useCallback((event: ScraperEvent) => {
    switch (event.type) {
      case 'lead:found': {
        const { lead } = event.data
        setLeads((prev) => {
          if (prev.some((l) => l.id === lead.id)) return prev
          return [
            {
              id: lead.id,
              schoolName: lead.schoolName,
              schoolUrl: lead.schoolUrl,
              status: lead.status,
              receivedAt: Date.now(),
            },
            ...prev,
          ].slice(0, 50)
        })
        setStats((prev) => ({ ...prev, total: prev.total + 1 }))
        setError(null)
        break
      }
      case 'lead:contact_parsed': {
        const { leadId, contact } = event.data
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId
              ? {
                  ...lead,
                  email: contact.email,
                  phone: contact.phone,
                  contactName: contact.contactName,
                  title: contact.title,
                  sport: contact.sport,
                  status: 'CONTACT_FOUND',
                }
              : lead
          )
        )
        setStats((prev) => ({
          ...prev,
          withEmail: contact.email ? prev.withEmail + 1 : prev.withEmail,
          withPhone: contact.phone ? prev.withPhone + 1 : prev.withPhone,
        }))
        setError(null)
        break
      }
      case 'campaign:progress': {
        const { currentStep, progress } = event.data
        setScraperStatus({
          active: true,
          step: currentStep,
          message: `${currentStep}: ${progress.current}/${progress.total}`,
        })
        setError(null)
        break
      }
      case 'campaign:status_changed': {
        const { status, message } = event.data
        if (['SCRAPE_COMPLETED', 'PARSING_COMPLETED', 'COMPLETED'].includes(status)) {
          setScraperStatus({ active: false, message: status })
        } else if (status === 'FAILED') {
          setError(message || 'Scraping failed')
          setScraperStatus({ active: false })
        } else if (['SCRAPING', 'PARSING_CONTACTS', 'SENDING_EMAILS'].includes(status)) {
          setScraperStatus({ active: true, message: status })
        }
        break
      }
      case 'campaign:error': {
        setError(event.data.error)
        setScraperStatus({ active: false })
        break
      }
    }
  }, [])

  const { connected } = useScraperStream({
    campaignId,
    onEvent: handleEvent,
    onError: (err) => setError(err.message),
  })

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Real-Time Scraping Results</CardTitle>
            <Badge
              variant="outline"
              className={
                connected
                  ? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400 text-xs'
                  : 'border-muted-foreground/30 text-muted-foreground text-xs'
              }
            >
              <span
                className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/50'
                }`}
              />
              {connected ? 'LIVE' : 'OFFLINE'}
            </Badge>
          </div>
          {scraperStatus.active && (
            <Badge variant="secondary" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              {scraperStatus.message}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total Leads"
            value={stats.total}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label="With Email"
            value={stats.withEmail}
            icon={<Mail className="h-4 w-4" />}
            accent="primary"
          />
          <StatCard
            label="With Phone"
            value={stats.withPhone}
            icon={<Phone className="h-4 w-4" />}
          />
        </div>

        {leads.length > 0 ? (
          <ScrollArea className="h-[240px] rounded-md border">
            <ul className="divide-y">
              {leads.map((lead, index) => (
                <li
                  key={lead.id}
                  className={`px-3 py-2 text-sm ${index === 0 && connected ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{lead.schoolName}</p>
                      {lead.contactName && (
                        <p className="text-xs text-muted-foreground">
                          {lead.contactName}
                          {lead.title ? ` — ${lead.title}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lead.email && (
                        <Badge variant="outline" className="text-[10px]">
                          <Mail className="h-3 w-3 mr-1" />
                          email
                        </Badge>
                      )}
                      {lead.phone && (
                        <Badge variant="outline" className="text-[10px]">
                          <Phone className="h-3 w-3 mr-1" />
                          phone
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {connected
              ? 'Waiting for leads... Scraping will appear here in real-time.'
              : 'Connecting to scraper stream...'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent?: 'primary'
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p
        className={`mt-1 text-2xl font-bold ${accent === 'primary' ? 'text-primary' : 'text-foreground'}`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  )
}
