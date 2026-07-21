'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Plus, Trash2, Users, Phone } from 'lucide-react'
import { toast } from 'sonner'

interface StaffRow {
  name: string
  role: string
  phone: string
  email: string
  isPrimaryContact: boolean
  notes: string
}

interface ContactRow {
  name: string
  organization: string
  role: string
  phone: string
  email: string
  notes: string
}

export interface EventFormData {
  id?: string
  title: string
  description?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  isWhereIsJose: boolean
  displayPriority: number
  staff?: StaffRow[]
  contacts?: ContactRow[]
}

/** ISO string -> value for <input type="datetime-local"> in local time. */
function toLocalInput(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyStaff = (): StaffRow => ({
  name: '',
  role: '',
  phone: '',
  email: '',
  isPrimaryContact: false,
  notes: '',
})

const emptyContact = (): ContactRow => ({
  name: '',
  organization: '',
  role: '',
  phone: '',
  email: '',
  notes: '',
})

export default function EventForm({ event }: { event?: EventFormData }) {
  const router = useRouter()
  const isEdit = Boolean(event?.id)

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [startDate, setStartDate] = useState(toLocalInput(event?.startDate))
  const [endDate, setEndDate] = useState(toLocalInput(event?.endDate))
  const [isWhereIsJose, setIsWhereIsJose] = useState(event?.isWhereIsJose ?? false)
  const [displayPriority, setDisplayPriority] = useState(event?.displayPriority ?? 0)
  const [staff, setStaff] = useState<StaffRow[]>(event?.staff ?? [])
  const [contacts, setContacts] = useState<ContactRow[]>(event?.contacts ?? [])
  const [saving, setSaving] = useState(false)

  function updateStaff(index: number, patch: Partial<StaffRow>) {
    setStaff((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function updateContact(index: number, patch: Partial<ContactRow>) {
    setContacts((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!startDate) {
      toast.error('Start date is required')
      return
    }

    setSaving(true)
    try {
      const cleanedStaff = staff.filter((s) => s.name.trim())
      const cleanedContacts = contacts.filter((c) => c.name.trim())

      const basePayload = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        // Featured window mirrors the event dates; kept internal to the form.
        featuredFrom: new Date(startDate).toISOString(),
        featuredTo: endDate ? new Date(endDate).toISOString() : null,
        isWhereIsJose,
        displayPriority: Number(displayPriority) || 0,
      }

      if (isEdit && event?.id) {
        const res = await fetch(`/api/admin/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...basePayload,
            staff: cleanedStaff,
            contacts: cleanedContacts,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Update failed')
        toast.success('Event updated')
      } else {
        const res = await fetch('/api/admin/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Create failed')
        const created = await res.json()

        // Persist staff / contacts on the freshly created event.
        if (created?.id && (cleanedStaff.length || cleanedContacts.length)) {
          await fetch(`/api/admin/events/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff: cleanedStaff, contacts: cleanedContacts }),
          })
        }
        toast.success('Event created')
      }

      router.push('/admin/events')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Event details */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Event Details</h2>

        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Farmers market, venue, address…"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start *</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="isWhereIsJose">"Where is Jose?" event</Label>
              <p className="text-xs text-muted-foreground">Highlight on the map / schedule.</p>
            </div>
            <Switch
              id="isWhereIsJose"
              checked={isWhereIsJose}
              onCheckedChange={setIsWhereIsJose}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayPriority">Display priority</Label>
            <Input
              id="displayPriority"
              type="number"
              value={displayPriority}
              onChange={(e) => setDisplayPriority(Number(e.target.value))}
            />
          </div>
        </div>
      </Card>

      {/* Staff / attendees */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-semibold">Attending Staff</h2>
              <p className="text-sm text-muted-foreground">Who from our team is working this event.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setStaff((r) => [...r, emptyStaff()])}>
            <Plus className="mr-2 h-4 w-4" /> Add person
          </Button>
        </div>

        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff assigned yet.</p>
        ) : (
          <div className="space-y-3">
            {staff.map((row, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Name *" value={row.name} onChange={(e) => updateStaff(i, { name: e.target.value })} />
                  <Input placeholder="Role (e.g. Booth lead)" value={row.role} onChange={(e) => updateStaff(i, { role: e.target.value })} />
                  <Input placeholder="Phone" value={row.phone} onChange={(e) => updateStaff(i, { phone: e.target.value })} />
                  <Input placeholder="Email" type="email" value={row.email} onChange={(e) => updateStaff(i, { email: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={row.isPrimaryContact} onCheckedChange={(v) => updateStaff(i, { isPrimaryContact: v })} />
                    Primary on-site contact
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStaff((rows) => rows.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* On-file contacts */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-semibold">Event Contacts</h2>
              <p className="text-sm text-muted-foreground">Organizer / venue personnel on file for this event.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setContacts((r) => [...r, emptyContact()])}>
            <Plus className="mr-2 h-4 w-4" /> Add contact
          </Button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts on file yet.</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((row, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Name *" value={row.name} onChange={(e) => updateContact(i, { name: e.target.value })} />
                  <Input placeholder="Organization" value={row.organization} onChange={(e) => updateContact(i, { organization: e.target.value })} />
                  <Input placeholder="Role (e.g. Market manager)" value={row.role} onChange={(e) => updateContact(i, { role: e.target.value })} />
                  <Input placeholder="Phone" value={row.phone} onChange={(e) => updateContact(i, { phone: e.target.value })} />
                  <Input placeholder="Email" type="email" value={row.email} onChange={(e) => updateContact(i, { email: e.target.value })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Input placeholder="Notes" value={row.notes} onChange={(e) => updateContact(i, { notes: e.target.value })} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setContacts((rows) => rows.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/events')} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEdit ? 'Save Changes' : 'Create Event'}
        </Button>
      </div>
    </form>
  )
}
