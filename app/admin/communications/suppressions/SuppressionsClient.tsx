'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmailSuppression, SuppressionReason } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Download, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Papa from 'papaparse'

interface SuppressionsClientProps {
  initialData: EmailSuppression[]
  initialTotal: number
}

const reasonColors: Record<SuppressionReason, string> = {
  HARD_BOUNCE: 'bg-destructive/10 text-destructive',
  SOFT_BOUNCE: 'bg-orange-100 text-orange-800',
  SPAM_COMPLAINT: 'bg-rose-100 text-rose-800',
  MANUAL: 'bg-muted text-foreground',
  UNSUBSCRIBE: 'bg-muted text-foreground',
  ADMIN: 'bg-purple-100 text-purple-800',
}

const reasonLabels: Record<SuppressionReason, string> = {
  HARD_BOUNCE: 'Hard Bounce',
  SOFT_BOUNCE: 'Soft Bounce',
  SPAM_COMPLAINT: 'Spam Complaint',
  MANUAL: 'Manual',
  UNSUBSCRIBE: 'Unsubscribe',
  ADMIN: 'Admin',
}

export function SuppressionsClient({ initialData, initialTotal }: SuppressionsClientProps) {
  const [items, setItems] = useState<EmailSuppression[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newReason, setNewReason] = useState<SuppressionReason>('MANUAL')
  const [newNotes, setNewNotes] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const fetchSuppressions = async (searchVal = search, reasonVal = reasonFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchVal) params.set('search', searchVal)
      if (reasonVal && reasonVal !== 'all') params.set('reason', reasonVal)
      params.set('limit', '50')
      const res = await fetch(`/api/admin/suppressions?${params.toString()}`)
      const data = await res.json() as { items: EmailSuppression[]; total: number }
      setItems(data.items)
      setTotal(data.total)
    } catch {
      setError('Failed to load suppressions')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchSuppressions()
  }

  const handleReasonFilter = (value: string) => {
    setReasonFilter(value)
    fetchSuppressions(search, value)
  }

  const handleAdd = async () => {
    if (!newEmail.trim()) return
    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch('/api/admin/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), reason: newReason, notes: newNotes || undefined }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setAddError(data.error || 'Failed to add suppression')
      } else {
        setNewEmail('')
        setNewNotes('')
        setIsAddOpen(false)
        fetchSuppressions()
      }
    } catch {
      setAddError('Failed to add suppression')
    } finally {
      setAddLoading(false)
    }
  }

  const handleRemove = async (email: string) => {
    if (!confirm(`Remove ${email} from the suppression list?`)) return
    try {
      await fetch(`/api/admin/suppressions?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
      fetchSuppressions()
    } catch {
      setError('Failed to remove suppression')
    }
  }

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (reasonFilter && reasonFilter !== 'all') params.set('reason', reasonFilter)
    params.set('limit', '10000')
    const res = await fetch(`/api/admin/suppressions?${params.toString()}`)
    const data = await res.json() as { items: EmailSuppression[] }
    const rows = data.items.map((s) => ({
      Email: s.email,
      Reason: s.reason,
      Source: s.source || '',
      Notes: s.notes || '',
      'Created At': s.createdAt,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'suppressions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            placeholder="Search email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={reasonFilter} onValueChange={handleReasonFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All reasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              {Object.entries(reasonLabels).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Suppression
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Email to Suppression List</DialogTitle>
                <DialogDescription>
                  This email will never receive marketing emails.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {addError && <p className="text-sm text-destructive">{addError}</p>}
                <div className="grid gap-2">
                  <Label htmlFor="sup-email">Email Address</Label>
                  <Input
                    id="sup-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Reason</Label>
                  <Select value={newReason} onValueChange={(v) => setNewReason(v as SuppressionReason)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(reasonLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sup-notes">Notes (optional)</Label>
                  <Input
                    id="sup-notes"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Reason for suppression..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={addLoading}>
                  {addLoading ? 'Adding...' : 'Add to Suppression List'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {total} suppressed email{total !== 1 ? 's' : ''}
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {items.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No suppressed emails found.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Reason</th>
                <th className="p-4 text-left font-medium">Source</th>
                <th className="p-4 text-left font-medium">Notes</th>
                <th className="p-4 text-left font-medium">Added</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-4 font-medium">{item.email}</td>
                  <td className="p-4">
                    <Badge className={reasonColors[item.reason]}>
                      {reasonLabels[item.reason]}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">{item.source || '-'}</td>
                  <td className="p-4 text-muted-foreground max-w-xs truncate">{item.notes || '-'}</td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(item.email)}
                      disabled={loading}
                      title="Remove from suppression list"
                    >
                      <span className="sr-only">Remove</span>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
