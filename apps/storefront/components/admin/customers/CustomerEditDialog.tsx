'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { CustomerRow } from './CustomersTable'

interface CustomerEditDialogProps {
  customer: CustomerRow | null
  onClose: () => void
  onSaved: () => void
}

type Draft = {
  firstName: string
  lastName: string
  phone: string
  accountType: string
  emailStatus: string
  emailPermissionStatus: string
  sourceName: string
  notes: string
}

function toDraft(c: CustomerRow): Draft {
  return {
    firstName: c.firstName ?? '',
    lastName: c.lastName ?? '',
    phone: c.phone ?? '',
    accountType: c.accountType,
    emailStatus: c.emailStatus ?? '',
    emailPermissionStatus: c.emailPermissionStatus ?? '',
    sourceName: c.sourceName ?? '',
    // Filled in by the fetch below — the list doesn't carry notes.
    notes: '',
  }
}

/**
 * Edits one customer inline from the list.
 *
 * Email and the order rollups are shown read-only — email is the key every
 * other system joins on, and the rollups are recomputed by the order sync.
 */
export function CustomerEditDialog({
  customer,
  onClose,
  onSaved,
}: CustomerEditDialogProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)

  // The list omits `notes` to keep a 500-row page small, so the full record is
  // fetched when the dialog opens. Saving is blocked until it arrives —
  // otherwise a quick save would submit an empty field and wipe the existing
  // note, which for imported customers is their whole provenance trail.
  useEffect(() => {
    if (!customer) {
      setDraft(null)
      return
    }
    setDraft(toDraft(customer))
    setLoadingNotes(true)

    let cancelled = false
    fetch(`/api/admin/customers/${customer.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((data) => {
        if (cancelled) return
        setDraft((prev) =>
          prev ? { ...prev, notes: data.customer?.notes ?? '' } : prev
        )
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to load customer notes:', error)
        toast.error('Could not load notes — reopen to try again')
        onClose()
      })
      .finally(() => {
        if (!cancelled) setLoadingNotes(false)
      })

    return () => {
      cancelled = true
    }
  }, [customer, onClose])

  async function save() {
    if (!customer || !draft) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to save')
      toast.success('Customer updated')
      onSaved()
    } catch (error) {
      console.error('Customer update failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof Draft) => (value: string) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))

  return (
    <Dialog open={Boolean(customer)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>{customer?.email}</DialogDescription>
        </DialogHeader>

        {draft && customer && (
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={draft.firstName}
                  onChange={(e) => set('firstName')(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={draft.lastName}
                  onChange={(e) => set('lastName')(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={draft.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accountType">Account type</Label>
                <Select
                  value={draft.accountType}
                  onValueChange={set('accountType')}
                >
                  <SelectTrigger id="accountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="FUNDRAISING">Fundraising</SelectItem>
                    <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sourceName">Organization / source name</Label>
              <Input
                id="sourceName"
                value={draft.sourceName}
                onChange={(e) => set('sourceName')(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="emailStatus">Email status</Label>
                <Input
                  id="emailStatus"
                  value={draft.emailStatus}
                  onChange={(e) => set('emailStatus')(e.target.value)}
                  placeholder="Active, Unsubscribed, Bounced…"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emailPermissionStatus">Permission</Label>
                <Input
                  id="emailPermissionStatus"
                  value={draft.emailPermissionStatus}
                  onChange={(e) => set('emailPermissionStatus')(e.target.value)}
                  placeholder="Implied, Express…"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={5}
                value={draft.notes}
                onChange={(e) => set('notes')(e.target.value)}
                disabled={loadingNotes}
                placeholder={loadingNotes ? 'Loading notes…' : undefined}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="mb-1 font-medium">Order history</p>
              <p className="text-muted-foreground">
                {customer.totalOrders} order
                {customer.totalOrders === 1 ? '' : 's'} · $
                {Number(customer.totalSpent).toFixed(2)} spent · last{' '}
                {customer.lastOrderAt
                  ? new Date(customer.lastOrderAt).toLocaleDateString()
                  : 'never'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recalculated by Sync from orders &amp; users, so it isn&apos;t
                editable here. The email address is the key other records join
                on and can&apos;t be changed.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loadingNotes || !draft}>
            {(saving || loadingNotes) && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
