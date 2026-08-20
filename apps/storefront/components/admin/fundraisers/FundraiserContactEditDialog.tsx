'use client'

import { useState } from 'react'

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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { FundraiserContactRow } from './FundraiserContactsTable'

/**
 * Edits the fields an admin owns. The sales rollups are shown read-only rather than hidden:
 * they are the reason to contact this organization at all, but they are recomputed from the
 * archive on every re-import, so letting someone type over them would be a lie.
 */
export function FundraiserContactEditDialog({
  contact,
  onClose,
  onSaved,
}: {
  contact: FundraiserContactRow
  onClose: () => void
  onSaved: () => void
}) {
  const [organizationName, setOrganizationName] = useState(contact.organizationName)
  const [contactName, setContactName] = useState(contact.contactName ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [status, setStatus] = useState(contact.status)
  const [isActive, setIsActive] = useState(contact.isActive)
  const [notes, setNotes] = useState(contact.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/fundraiser-contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          contactName,
          email,
          phone,
          status,
          isActive,
          notes,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Could not save this contact')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
          <DialogDescription>
            Sales history comes from the document archive and is refreshed on every re-import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 grid grid-cols-3 gap-2 rounded-md p-3 text-center text-sm">
            <ReadOnlyStat label="Jars" value={contact.totalJars.toLocaleString()} />
            <ReadOnlyStat label="Campaigns" value={String(contact.campaignCount)} />
            <ReadOnlyStat
              label="Years"
              value={contact.years.length ? contact.years.join(', ') : '—'}
            />
          </div>

          <Field label="Organization" htmlFor="organizationName">
            <Input
              id="organizationName"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
            />
          </Field>

          <Field label="Contact name" htmlFor="contactName">
            <Input
              id="contactName"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Coordinator's name"
            />
          </Field>

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Leave blank if unknown"
            />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="10-digit US number"
            />
          </Field>

          <Field label="Status" htmlFor="status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="RESPONDED">Responded</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="DO_NOT_CONTACT">Do not contact</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isActive">Active</Label>
              <p className="text-muted-foreground text-xs">
                Inactive contacts keep their history but are excluded from outreach.
              </p>
            </div>
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </Field>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !organizationName.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function ReadOnlyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
