'use client'

import { useScraperStream } from '@/hooks/use-scraper-stream'
import type { ScraperEvent } from '@/lib/scraper/event-bus'
import { useCallback, useState } from 'react'

interface Lead {
  id: string
  schoolName: string
  schoolUrl: string
  email?: string
  phone?: string
  contactName?: string
  title?: string
  sport?: string
  status: string
}

interface LiveLeadFeedProps {
  campaignId: string
}

/**
 * Real-time display of scraped leads as they're discovered
 * Connects to SSE stream and renders leads as they appear
 */
export function LiveLeadFeed({ campaignId }: LiveLeadFeedProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState({
    total: 0,
    withEmail: 0,
    withPhone: 0,
  })
  const [scraperStatus, setScraperStatus] = useState<{
    active: boolean
    step?: string
    message?: string
  }>({ active: false })
  const [error, setError] = useState<string | null>(null)

  const handleEvent = useCallback((event: ScraperEvent) => {
    switch (event.type) {
      case 'lead:found': {
        const { lead } = event.data
        setLeads((prev) => [
          {
            id: lead.id,
            schoolName: lead.schoolName,
            schoolUrl: lead.schoolUrl,
            status: lead.status,
          },
          ...prev,
        ])
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
        }))
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
        if (status === 'SCRAPE_COMPLETED' || status === 'PARSE_COMPLETED') {
          setScraperStatus({ active: false, message: status })
        } else if (status === 'FAILED') {
          setError(message || 'Scraping failed')
          setScraperStatus({ active: false })
        }
        break
      }

      case 'campaign:error': {
        const { error: errorMsg } = event.data
        setError(errorMsg)
        setScraperStatus({ active: false })
        break
      }
    }
  }, [])

  const { connected, error: streamError } = useScraperStream({
    campaignId,
    onEvent: handleEvent,
    onError: (err) => setError(err.message),
  })

  return (
    <div className="mt-8 space-y-4">
      {/* Status Bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${connected ? 'bg-green-500' : 'bg-muted/60'}`}
            />
            <span className="text-sm font-medium text-foreground">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {scraperStatus.active && (
            <div className="text-sm text-blue-600">{scraperStatus.message}</div>
          )}

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Leads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.withEmail}</div>
            <div className="text-xs text-muted-foreground">With Email</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{stats.withPhone}</div>
            <div className="text-xs text-muted-foreground">With Phone</div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      {leads.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">
                    School Name
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">
                    Contact Name
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">
                    Sport
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => (
                  <tr
                    key={lead.id}
                    className={`border-b border-border ${
                      index === 0 ? 'bg-blue-50' : ''
                    } hover:bg-muted/50`}
                  >
                    <td className="px-6 py-3 text-foreground">
                      <div className="font-medium">{lead.schoolName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {lead.schoolUrl}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {lead.contactName || '—'}
                    </td>
                    <td className="px-6 py-3 text-foreground">{lead.title || '—'}</td>
                    <td className="px-6 py-3">
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {lead.phone || '—'}
                    </td>
                    <td className="px-6 py-3 text-foreground">{lead.sport || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {leads.length === 0 && (
        <div className="rounded-lg border border-dashed border-input bg-muted/50 p-8 text-center">
          <div className="text-muted-foreground">
            {connected ? (
              <p>Waiting for leads... Scraping will appear here in real-time</p>
            ) : (
              <p>Connecting to scraper stream...</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
