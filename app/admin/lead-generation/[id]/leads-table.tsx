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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

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

const ALL_STATUSES = ['SCRAPED', 'CONTACT_FOUND', 'EMAIL_SENT', 'EMAIL_FAILED'] as const

export function LeadsTable({ leads, leadType, campaignId, onSelectionChange }: LeadsTableProps) {
  const router = useRouter()

  const initialScrapedIds = useMemo(
    () => new Set(leads.filter((l) => l.status === 'SCRAPED').map((l) => l.id)),
    [leads]
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialScrapedIds)

  const notifySelection = useCallback(
    (ids: Set<string>) => {
      onSelectionChange?.(Array.from(ids))
    },
    [onSelectionChange]
  )

  useEffect(() => {
    notifySelection(selectedIds)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [hasEmailFilter, setHasEmailFilter] = useState<string>('all')
  const [sportFilter, setSportFilter] = useState('')
  const [minRating, setMinRating] = useState('')
  const [exporting, setExporting] = useState(false)

  const isBusiness = leadType === 'LOCAL_BUSINESS'

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
      if (minRating && lead.rating != null && lead.rating < parseFloat(minRating))
        return false
      return true
    })
  }, [leads, statusFilter, hasEmailFilter, sportFilter, minRating])

  const allSelected =
    filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id))

  const scrapedCount = leads.filter((l) => l.status === 'SCRAPED').length
  const selectedScrapedCount = leads.filter(
    (l) => l.status === 'SCRAPED' && selectedIds.has(l.id)
  ).length

  function toggleAll() {
    const next = allSelected
      ? new Set<string>()
      : new Set(filteredLeads.map((l) => l.id))
    setSelectedIds(next)
    notifySelection(next)
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      notifySelection(next)
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
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!response.ok) throw new Error('Delete failed')
      setSelectedIds(new Set())
      router.refresh()
    } catch {
      alert('Failed to delete leads.')
    }
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="text-muted-foreground p-8 text-center border rounded">
        No leads found yet.
      </div>
    )
  }

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
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
              >
                Delete Selected ({selectedIds.size})
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport(false)}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export All'}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredLeads.length} of {leads.length} leads
        </p>
        {scrapedCount > 0 && (
          <p className="text-sm font-medium text-primary">
            {selectedScrapedCount} of {scrapedCount} leads selected for contact scraping
          </p>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>{isBusiness ? 'Business' : 'School'}</TableHead>
              {isBusiness && <TableHead>Address</TableHead>}
              {isBusiness && <TableHead>Rating</TableHead>}
              <TableHead>Contact</TableHead>
              <TableHead>Title</TableHead>
              {!isBusiness && <TableHead>Sport</TableHead>}
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(lead.id)}
                    onCheckedChange={() => toggleOne(lead.id)}
                    aria-label={`Select ${lead.schoolName || lead.businessName}`}
                  />
                </TableCell>
                <TableCell>
                  <div
                    className="font-medium truncate max-w-[200px]"
                    title={
                      isBusiness
                        ? (lead.businessName ?? '')
                        : lead.schoolName
                    }
                  >
                    {isBusiness
                      ? (lead.businessName || lead.schoolName)
                      : lead.schoolName}
                  </div>
                  {(isBusiness ? lead.website : lead.schoolUrl) && (
                    <a
                      href={
                        (isBusiness ? lead.website : lead.schoolUrl) ?? undefined
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline truncate block max-w-[200px]"
                    >
                      Website
                    </a>
                  )}
                </TableCell>
                {isBusiness && (
                  <TableCell>
                    <span
                      className="text-sm truncate block max-w-[180px]"
                      title={lead.address ?? ''}
                    >
                      {lead.address || '-'}
                    </span>
                  </TableCell>
                )}
                {isBusiness && (
                  <TableCell>
                    {lead.rating != null ? (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {lead.rating.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({lead.reviewCount ?? 0})
                        </span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                )}
                <TableCell>{lead.contactName || '-'}</TableCell>
                <TableCell>{lead.title || '-'}</TableCell>
                {!isBusiness && <TableCell>{lead.sport || '-'}</TableCell>}
                <TableCell>{lead.email || '-'}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lead.status === 'EMAIL_SENT'
                        ? 'default'
                        : lead.status === 'EMAIL_FAILED'
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {lead.status}
                  </Badge>
                  {lead.errorMessage && (
                    <p
                      className="text-xs text-destructive mt-1 truncate max-w-[150px]"
                      title={lead.errorMessage}
                    >
                      {lead.errorMessage}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
