'use client'

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
const ACTIVE_STATUSES = ['SCRAPING', 'PARSING_CONTACTS', 'SENDING_EMAILS']

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

// --- Activity Log types ---

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  stage: 'search' | 'parse' | 'email' | 'system' | 'action'
  message: string
  detail?: string
}

interface ActivityLogHandle {
  addEntry: (level: LogEntry['level'], stage: LogEntry['stage'], message: string, detail?: string) => void
  startScrapeTimer: () => void
}

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-blue-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400',
}

const STAGE_LABELS: Record<LogEntry['stage'], string> = {
  search: 'SEARCH',
  parse: 'PARSE',
  email: 'EMAIL',
  system: 'SYSTEM',
  action: 'ACTION',
}

const STAGE_COLORS: Record<LogEntry['stage'], string> = {
  search: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  parse: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  email: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  system: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
  action: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
}

function makeEntry(level: LogEntry['level'], stage: LogEntry['stage'], message: string, detail?: string): LogEntry {
  return { timestamp: new Date().toISOString(), level, stage, message, detail }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '??:??:??'
  }
}

// --- Activity Log Component ---

const ActivityLog = forwardRef<ActivityLogHandle, { campaignId: string }>(
  function ActivityLog({ campaignId }, ref) {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [connected, setConnected] = useState(false)
    const [autoScroll, setAutoScroll] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)
    const sseEventCountRef = useRef(0)
    const scrapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const pushEntry = useCallback((entry: LogEntry) => {
      setLogs((prev) => {
        const next = [...prev, entry]
        return next.length > 500 ? next.slice(-500) : next
      })
    }, [])

    const addEntry = useCallback(
      (level: LogEntry['level'], stage: LogEntry['stage'], message: string, detail?: string) => {
        pushEntry(makeEntry(level, stage, message, detail))
      },
      [pushEntry]
    )

    const startScrapeTimer = useCallback(() => {
      sseEventCountRef.current = 0
      if (scrapeTimerRef.current) clearTimeout(scrapeTimerRef.current)
      scrapeTimerRef.current = setTimeout(() => {
        if (sseEventCountRef.current === 0) {
          pushEntry(
            makeEntry(
              'warn',
              'system',
              'No events received after 10s — scraper may not be running on this environment'
            )
          )
        }
      }, 10000)
    }, [pushEntry])

    useImperativeHandle(ref, () => ({ addEntry, startScrapeTimer }), [addEntry, startScrapeTimer])

    useEffect(() => {
      pushEntry(makeEntry('info', 'system', `Connecting to event stream for campaign ${campaignId.slice(0, 8)}...`))

      const es = new EventSource(`/api/admin/scraper-logs/${campaignId}`)

      es.onopen = () => {
        setConnected(true)
        pushEntry(makeEntry('success', 'system', 'Connected to event stream'))
      }

      es.onmessage = (event) => {
        try {
          const entry: LogEntry = JSON.parse(event.data)
          sseEventCountRef.current += 1
          pushEntry(entry)
        } catch {
          // ignore
        }
      }

      es.onerror = () => {
        setConnected((prev) => {
          if (prev) {
            pushEntry(makeEntry('error', 'system', 'Event stream disconnected — reconnecting...'))
          }
          return false
        })
      }

      return () => {
        es.close()
        if (scrapeTimerRef.current) clearTimeout(scrapeTimerRef.current)
      }
    }, [campaignId, pushEntry])

    useEffect(() => {
      if (autoScroll && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, [logs, autoScroll])

    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                connected
                  ? 'border-green-500/50 bg-green-500/10 text-green-400 text-xs'
                  : 'border-red-500/50 bg-red-500/10 text-red-400 text-xs'
              }
            >
              <span
                className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`}
              />
              {connected ? 'LIVE' : 'DISCONNECTED'}
            </Badge>
            <span className="text-xs text-zinc-500">{logs.length} events</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-zinc-500 hover:text-zinc-300"
              onClick={() => setAutoScroll((v) => !v)}
            >
              {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-zinc-500 hover:text-zinc-300"
              onClick={() => setLogs([])}
            >
              Clear
            </Button>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="h-[320px] overflow-y-auto font-mono text-xs leading-relaxed px-4 py-2"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-600">
              Waiting for activity...
            </div>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className="flex gap-2 py-0.5 hover:bg-zinc-900/50">
                <span className="text-zinc-600 shrink-0">
                  {formatTime(entry.timestamp)}
                </span>
                <span
                  className={`shrink-0 inline-flex items-center rounded border px-1.5 text-[10px] font-medium ${
                    STAGE_COLORS[entry.stage] ?? STAGE_COLORS.system
                  }`}
                >
                  {STAGE_LABELS[entry.stage] ?? entry.stage.toUpperCase()}
                </span>
                <span className={LEVEL_COLORS[entry.level]}>{entry.message}</span>
                {entry.detail && (
                  <span className="text-zinc-600 truncate" title={entry.detail}>
                    {entry.detail}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }
)

// --- Main Component ---

interface CampaignManagerProps {
  campaign: CampaignWithTemplate
  selectedLeadIds?: string[]
}

export function CampaignManager({ campaign, selectedLeadIds }: CampaignManagerProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const logRef = useRef<ActivityLogHandle>(null)

  const isActive = ACTIVE_STATUSES.includes(campaign.status)
  const defaultTab = isActive ? 'activity' : 'template'

  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(interval)
  }, [isActive, router])

  const labels = getLeadTypeLabels(campaign.leadType)

  const handleStreamingScrape = async (actionLabel: string) => {
    logRef.current?.addEntry('info', 'action', `User triggered "${actionLabel}"`)
    logRef.current?.addEntry('info', 'action', 'Starting scrape via streaming endpoint...')
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/lead-generation/${campaign.id}/run`, {
        method: 'POST',
      })

      if (!res.ok) {
        const text = await res.text()
        logRef.current?.addEntry('error', 'action', `Server error ${res.status}: ${text}`)
        setLoading(false)
        return
      }

      logRef.current?.addEntry('success', 'action', 'Connected to scrape stream — receiving events...')

      const reader = res.body?.getReader()
      if (!reader) {
        logRef.current?.addEntry('error', 'action', 'No response stream available')
        setLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const entry = JSON.parse(line.slice(6))
            if (entry.level && entry.stage && entry.message) {
              logRef.current?.addEntry(entry.level, entry.stage, entry.message)
            }
          } catch { /* skip non-JSON lines */ }
        }
      }

      logRef.current?.addEntry('info', 'system', 'Scrape stream ended.')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logRef.current?.addEntry('error', 'action', `Scrape failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStreamingParse = async (actionLabel: string) => {
    logRef.current?.addEntry('info', 'action', `User triggered "${actionLabel}"`)
    logRef.current?.addEntry('info', 'action', 'Starting contact parsing via streaming endpoint...')
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/lead-generation/${campaign.id}/parse`, {
        method: 'POST',
      })

      if (!res.ok) {
        const text = await res.text()
        logRef.current?.addEntry('error', 'action', `Server error ${res.status}: ${text}`)
        setLoading(false)
        return
      }

      logRef.current?.addEntry('success', 'action', 'Connected to parse stream — receiving events...')

      const reader = res.body?.getReader()
      if (!reader) {
        logRef.current?.addEntry('error', 'action', 'No response stream available')
        setLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const entry = JSON.parse(line.slice(6))
            if (entry.level && entry.stage && entry.message) {
              logRef.current?.addEntry(entry.level, entry.stage, entry.message)
            }
          } catch { /* skip non-JSON lines */ }
        }
      }

      logRef.current?.addEntry('info', 'system', 'Parse stream ended.')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logRef.current?.addEntry('error', 'action', `Parse failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (
    actionFn: (id: string) => Promise<unknown>,
    actionLabel: string,
    confirmMsg?: string
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return

    logRef.current?.addEntry('info', 'action', `User triggered "${actionLabel}"`)
    logRef.current?.addEntry('info', 'action', `Calling server action...`)

    setLoading(true)
    try {
      await actionFn(campaign.id)
      logRef.current?.addEntry('success', 'action', `Server acknowledged — ${actionLabel} started`)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logRef.current?.addEntry('error', 'action', `Server action failed: ${msg}`)
      alert('Action failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.'))
      return
    logRef.current?.addEntry('warn', 'action', 'User triggered "Delete Campaign"')
    setLoading(true)
    try {
      await deleteLeadCampaign(campaign.id)
      router.push('/admin/lead-generation')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logRef.current?.addEntry('error', 'action', `Delete failed: ${msg}`)
      setLoading(false)
    }
  }

  const onSaveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    logRef.current?.addEntry('info', 'action', 'Saving email template...')
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      await saveCampaignTemplate(campaign.id, {
        name: fd.get('name') as string,
        subject: fd.get('subject') as string,
        htmlContent: fd.get('htmlContent') as string,
      })
      logRef.current?.addEntry('success', 'action', 'Email template saved successfully')
      router.refresh()
      alert('Template saved.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logRef.current?.addEntry('error', 'action', `Failed to save template: ${msg}`)
      alert('Failed to save template.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left: Campaign Status */}
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
            onClick={() =>
              handleStreamingScrape(labels.searchStep.replace(/^\d+\.\s*/, ''))
            }
            disabled={loading || campaign.status === 'SCRAPING'}
          >
            {labels.searchStep}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStreamingParse('Find Contacts')}
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
                'Send Emails',
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
                  'One-Click Scan & Send',
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

      {/* Right: Tabbed Activity Log / Email Template */}
      <Card>
        <Tabs defaultValue={defaultTab}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Campaign Tools</CardTitle>
              <TabsList>
                <TabsTrigger value="activity" className="text-xs">
                  Activity Log
                  {isActive && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="template" className="text-xs">
                  Email Template
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="activity" className="mt-0">
              <ActivityLog ref={logRef} campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="template" className="mt-0">
              <CardDescription className="mb-4">
                Configure the email automatically sent to leads. Available variables:{' '}
                {labels.templateVars}
              </CardDescription>
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
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
