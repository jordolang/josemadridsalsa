'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronUp, ExternalLink, Inbox, Search, Play, X as XIcon } from 'lucide-react'
import { CustomScrapeDialog } from './custom-scrape-dialog'

interface Lead {
  id: string
  schoolName: string
  schoolUrl?: string | null
  businessName?: string | null
  businessCategory?: string | null
  address?: string | null
  rating?: number | null
  reviewCount?: number | null
  website?: string | null
  googleMapsUrl?: string | null
  contactName?: string | null
  title?: string | null
  sport?: string | null
  email?: string | null
  phone?: string | null
  status: string
  errorMessage?: string | null
}

interface LeadsTableProps {
  leads: Lead[]
  leadType: string
  campaignId: string
  onSelectionChange?: (selectedIds: string[]) => void
}

interface LeadGroup {
  id: string
  displayName: string
  url: string | null
  primaryLead: Lead
  contacts: Lead[]
  hasAnyEmail: boolean
  status: string
}

const ALL_STATUSES = ['SCRAPED', 'CONTACT_FOUND', 'EMAIL_SENT', 'EMAIL_FAILED'] as const
const PAGE_SIZE = 10

function getLeadName(lead: Lead, isBusiness: boolean): string {
  return isBusiness
    ? lead.businessName || lead.schoolName
    : lead.schoolName || lead.businessName || 'Unnamed'
}

function getLeadUrl(lead: Lead, isBusiness: boolean): string | null {
  const url = isBusiness ? lead.website : lead.schoolUrl
  return url || null
}

function safeHost(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function groupLeads(leads: Lead[], isBusiness: boolean): LeadGroup[] {
  // Group by display name + host so multiple contacts for the same lead collapse together
  const map = new Map<string, LeadGroup>()
  for (const lead of leads) {
    const name = getLeadName(lead, isBusiness)
    const url = getLeadUrl(lead, isBusiness)
    const key = `${name}|${safeHost(url)}`
    const existing = map.get(key)
    if (existing) {
      existing.contacts.push(lead)
      if (lead.email) existing.hasAnyEmail = true
    } else {
      map.set(key, {
        id: key,
        displayName: name,
        url,
        primaryLead: lead,
        contacts: [lead],
        hasAnyEmail: !!lead.email,
        status: lead.status,
      })
    }
  }
  return Array.from(map.values())
}

export function LeadsTable({ leads, leadType, campaignId, onSelectionChange }: LeadsTableProps) {
  const router = useRouter()
  const isBusiness = leadType === 'LOCAL_BUSINESS'

  const initialScrapedIds = useMemo(
    () => new Set(leads.filter((l) => l.status === 'SCRAPED').map((l) => l.id)),
    [leads]
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialScrapedIds)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [hasEmailFilter, setHasEmailFilter] = useState<string>('all')
  const [sportFilter, setSportFilter] = useState('')
  const [minRating, setMinRating] = useState('')
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)

  // Custom scrape draft row state
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [creatingDraft, setCreatingDraft] = useState(false)

  // Scrape progress dialog state
  const [scrapeDialogOpen, setScrapeDialogOpen] = useState(false)
  const [scrapeLeadId, setScrapeLeadId] = useState<string | null>(null)
  const [scrapeContext, setScrapeContext] = useState<{ name: string; url: string }>({
    name: '',
    url: '',
  })

  const notifySelection = useCallback(
    (ids: Set<string>) => {
      onSelectionChange?.(Array.from(ids))
    },
    [onSelectionChange]
  )

  useEffect(() => {
    notifySelection(selectedIds)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false
      if (hasEmailFilter === 'yes' && !lead.email) return false
      if (hasEmailFilter === 'no' && lead.email) return false
      if (
        sportFilter &&
        (!lead.sport || !lead.sport.toLowerCase().includes(sportFilter.toLowerCase()))
      )
        return false
      if (minRating) {
        const threshold = Number.parseFloat(minRating)
        if (Number.isFinite(threshold)) {
          if (lead.rating == null || lead.rating < threshold) return false
        }
      }
      return true
    })
  }, [leads, statusFilter, hasEmailFilter, sportFilter, minRating])

  const groups = useMemo(() => groupLeads(filteredLeads, isBusiness), [filteredLeads, isBusiness])
  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedGroups = useMemo(
    () => groups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [groups, currentPage]
  )

  const scrapedCount = leads.filter((l) => l.status === 'SCRAPED').length
  const selectedScrapedCount = leads.filter(
    (l) => l.status === 'SCRAPED' && selectedIds.has(l.id)
  ).length

  const allOnPageSelected =
    pagedGroups.length > 0 &&
    pagedGroups.every((g) => g.contacts.every((c) => selectedIds.has(c.id)))

  function toggleAllOnPage() {
    const next = new Set(selectedIds)
    const ids = pagedGroups.flatMap((g) => g.contacts.map((c) => c.id))
    if (allOnPageSelected) {
      ids.forEach((id) => next.delete(id))
    } else {
      ids.forEach((id) => next.add(id))
    }
    setSelectedIds(next)
    notifySelection(next)
  }

  function toggleGroup(group: LeadGroup) {
    const next = new Set(selectedIds)
    const allInGroupSelected = group.contacts.every((c) => next.has(c.id))
    if (allInGroupSelected) {
      group.contacts.forEach((c) => next.delete(c.id))
    } else {
      group.contacts.forEach((c) => next.add(c.id))
    }
    setSelectedIds(next)
    notifySelection(next)
  }

  function toggleExpand(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  async function handleExport(onlySelected: boolean) {
    setExporting(true)
    try {
      const params = new URLSearchParams({ campaignId })
      if (onlySelected && selectedIds.size > 0) {
        params.set('ids', Array.from(selectedIds).join(','))
      }
      const response = await fetch(`/api/admin/lead-generation/export?${params}`)
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-${campaignId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export leads.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected leads? This cannot be undone.`))
      return
    try {
      const response = await fetch('/api/admin/lead-generation/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, ids: Array.from(selectedIds) }),
      })
      if (!response.ok) throw new Error('Delete failed')
      setSelectedIds(new Set())
      router.refresh()
    } catch {
      alert('Failed to delete leads.')
    }
  }

  function openDraft() {
    setDraftName('')
    setDraftUrl('')
    setDraftOpen(true)
  }

  function cancelDraft() {
    if (creatingDraft) return
    setDraftOpen(false)
    setDraftName('')
    setDraftUrl('')
  }

  async function handleBeginScraping() {
    const schoolName = draftName.trim()
    const url = draftUrl.trim()
    if (!schoolName) {
      alert('Please enter a school name.')
      return
    }
    try {
      // Validate URL client-side before POST
      new URL(url)
    } catch {
      alert('Please enter a valid URL (including https://).')
      return
    }

    setCreatingDraft(true)
    try {
      const res = await fetch(`/api/admin/lead-generation/${campaignId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName, url }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        alert(body?.error || 'Failed to create custom lead.')
        return
      }
      const payload = await res.json()
      const newLeadId = payload?.data?.lead?.id ?? payload?.lead?.id
      if (!newLeadId) {
        alert('Lead created but response was malformed.')
        return
      }

      setScrapeContext({ name: schoolName, url })
      setScrapeLeadId(newLeadId)
      setScrapeDialogOpen(true)
      setDraftOpen(false)
    } catch {
      alert('Failed to start custom scrape.')
    } finally {
      setCreatingDraft(false)
    }
  }

  function handleScrapeDone() {
    // Refresh server component to pick up the new lead + any contacts found
    router.refresh()
  }

  const isEmpty = !leads || leads.length === 0

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Has Email</span>
          <Select value={hasEmailFilter} onValueChange={setHasEmailFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">With Email</SelectItem>
              <SelectItem value="no">No Email</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isBusiness && (
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Min Rating</span>
            <Input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              placeholder="0-5"
              className="w-[100px]"
            />
          </div>
        )}

        {!isBusiness && (
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Sport</span>
            <Input
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              placeholder="Filter by sport"
              className="w-[150px]"
            />
          </div>
        )}

        <div className="ml-auto flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(true)}
                disabled={exporting}
              >
                Export Selected ({selectedIds.size})
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                Delete Selected ({selectedIds.size})
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport(false)}
            disabled={exporting || isEmpty}
          >
            {exporting ? 'Exporting...' : 'Export All'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={openDraft}
            disabled={draftOpen}
          >
            <Search className="mr-1 h-4 w-4" />
            Custom Scrape
          </Button>
        </div>
      </div>

      {/* Count bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {groups.length} {groups.length === 1 ? 'lead' : 'leads'} ({leads.length}{' '}
          total records)
        </p>
        {scrapedCount > 0 && (
          <p className="text-sm font-medium text-primary">
            {selectedScrapedCount} of {scrapedCount} leads selected for contact scraping
          </p>
        )}
      </div>

      {/* Outer table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={toggleAllOnPage}
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead>{isBusiness ? 'Business' : 'School'}</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-[120px]">Contacts</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {draftOpen && (
              <TableRow className="bg-primary/5 hover:bg-primary/10">
                <TableCell />
                <TableCell>
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={isBusiness ? 'Business Name' : 'School Name'}
                    className="h-8 max-w-[260px]"
                    disabled={creatingDraft}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder="https://staff-directory.example.edu"
                    className="h-8"
                    disabled={creatingDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleBeginScraping()
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">draft</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">NEW</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={handleBeginScraping}
                      disabled={creatingDraft}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      {creatingDraft ? 'Starting…' : 'Begin Scraping'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={cancelDraft}
                      disabled={creatingDraft}
                      aria-label="Cancel draft"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {isEmpty && !draftOpen && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState />
                </TableCell>
              </TableRow>
            )}
            {pagedGroups.map((group) => {
              const expanded = expandedGroups.has(group.id)
              const allInGroupSelected = group.contacts.every((c) => selectedIds.has(c.id))
              const someInGroupSelected = group.contacts.some((c) => selectedIds.has(c.id))
              return (
                <Collapsible key={group.id} asChild open={expanded}>
                  <>
                    <TableRow className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={
                            allInGroupSelected
                              ? true
                              : someInGroupSelected
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={() => toggleGroup(group)}
                          aria-label={`Select ${group.displayName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium max-w-[260px] truncate" title={group.displayName}>
                          {group.displayName}
                        </div>
                      </TableCell>
                      <TableCell>
                        {group.url ? <SourceUrl url={group.url} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {group.contacts.length}{' '}
                          {group.contacts.length === 1 ? 'contact' : 'contacts'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={group.status} />
                      </TableCell>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleExpand(group.id)}
                            aria-label={expanded ? 'Collapse' : 'Expand'}
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="p-0">
                          <ScrollArea className="max-h-[320px]">
                            <InnerContactsTable
                              contacts={group.contacts}
                              isBusiness={isBusiness}
                            />
                          </ScrollArea>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => {
                  e.preventDefault()
                  setPage((p) => Math.max(1, p - 1))
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {buildPageNumbers(currentPage, totalPages).map((item, i) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === currentPage}
                    onClick={(e) => {
                      e.preventDefault()
                      setPage(item)
                    }}
                    className="cursor-pointer"
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={(e) => {
                  e.preventDefault()
                  setPage((p) => Math.min(totalPages, p + 1))
                }}
                aria-disabled={currentPage === totalPages}
                className={
                  currentPage === totalPages
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <CustomScrapeDialog
        open={scrapeDialogOpen}
        onOpenChange={setScrapeDialogOpen}
        campaignId={campaignId}
        leadId={scrapeLeadId}
        schoolName={scrapeContext.name}
        url={scrapeContext.url}
        onComplete={handleScrapeDone}
      />
    </div>
  )
}

function buildPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | 'ellipsis'> = [1]
  if (current > 3) pages.push('ellipsis')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('ellipsis')
  pages.push(total)
  return pages
}

function StatusBadge({ status }: { status: string }) {
  const variant: 'default' | 'destructive' | 'outline' | 'secondary' =
    status === 'EMAIL_SENT'
      ? 'default'
      : status === 'EMAIL_FAILED'
        ? 'destructive'
        : status === 'CONTACT_FOUND'
          ? 'secondary'
          : 'outline'
  return (
    <Badge variant={variant} className="text-xs">
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

function SourceUrl({ url }: { url: string }) {
  const host = safeHost(url)
  const previewSrc = `https://image.thum.io/get/width/300/${encodeURIComponent(url)}`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline max-w-[200px] truncate"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{host}</span>
        </a>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[220px] p-2" sideOffset={8}>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground truncate" title={url}>
            {url}
          </p>
          <div className="relative aspect-square w-full overflow-hidden rounded border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt={`Preview of ${host}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function InnerContactsTable({
  contacts,
  isBusiness,
}: {
  contacts: Lead[]
  isBusiness: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {!isBusiness && <TableHead className="h-9 text-xs">Sport</TableHead>}
          <TableHead className="h-9 text-xs">Contact</TableHead>
          <TableHead className="h-9 text-xs">Title</TableHead>
          <TableHead className="h-9 text-xs">Email</TableHead>
          <TableHead className="h-9 text-xs">Phone</TableHead>
          <TableHead className="h-9 text-xs">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id} className="hover:bg-muted/50">
            {!isBusiness && (
              <TableCell className="py-2 text-sm">{contact.sport || '—'}</TableCell>
            )}
            <TableCell className="py-2 text-sm">{contact.contactName || '—'}</TableCell>
            <TableCell className="py-2 text-sm">{contact.title || '—'}</TableCell>
            <TableCell className="py-2 text-sm">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="text-primary hover:underline"
                >
                  {contact.email}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="py-2 text-sm">{contact.phone || '—'}</TableCell>
            <TableCell className="py-2">
              <StatusBadge status={contact.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Inbox className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-medium">No leads yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Run &ldquo;Search Schools&rdquo; or &ldquo;Search Businesses&rdquo; to start
          finding leads. Results will appear here as they&rsquo;re discovered.
        </p>
      </CardContent>
    </Card>
  )
}
