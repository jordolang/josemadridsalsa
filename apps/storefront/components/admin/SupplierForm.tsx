'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const EMPTY = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address1: '',
  city: '',
  state: '',
  postalCode: '',
  notes: '',
}

/** Add a supplier. Only the name is required — the rest is paperwork you may not have yet. */
export function SupplierForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [values, setValues] = useState(EMPTY)

  const set = (key: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }))

  async function submit() {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ''))
        ),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Could not add the supplier')
        return
      }
      toast.success(`${data.supplier.name} added`)
      setValues(EMPTY)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Could not add the supplier')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add supplier</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a supplier</DialogTitle>
          <DialogDescription>
            Only the name is required. Everything else can be filled in later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="supplier-name">Name</Label>
            <Input id="supplier-name" value={values.name} onChange={set('name')} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="supplier-contact">Contact</Label>
              <Input id="supplier-contact" value={values.contactName} onChange={set('contactName')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input id="supplier-phone" value={values.phone} onChange={set('phone')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="supplier-email">Email</Label>
            <Input id="supplier-email" type="email" value={values.email} onChange={set('email')} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="supplier-address">Address</Label>
            <Input id="supplier-address" value={values.address1} onChange={set('address1')} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="supplier-city">City</Label>
              <Input id="supplier-city" value={values.city} onChange={set('city')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-state">State</Label>
              <Input id="supplier-state" value={values.state} onChange={set('state')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-zip">ZIP</Label>
              <Input id="supplier-zip" value={values.postalCode} onChange={set('postalCode')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="supplier-notes">Notes</Label>
            <Textarea id="supplier-notes" rows={2} value={values.notes} onChange={set('notes')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSaving || values.name.trim() === ''}>
            {isSaving ? 'Saving…' : 'Add supplier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
