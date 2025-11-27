'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewLocationPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    businessName: '', address: '', city: '', state: '', zipCode: '', phone: '', website: '', photoUrl: '', county: '', isActive: true, sortOrder: 0,
  })
  const [saving, setSaving] = useState(false)

  const onChange = (e: any) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const onSubmit = async (e: any) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      sortOrder: Number(form.sortOrder) || 0,
    }
    const res = await fetch('/api/admin/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) router.push('/admin/locations')
  }

  return (
    <div className="max-w-2xl">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>New Location</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Business Name</Label>
              <Input name="businessName" value={form.businessName} onChange={onChange} required />
            </div>
            <div>
              <Label>Address</Label>
              <Input name="address" value={form.address} onChange={onChange} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>City</Label>
                <Input name="city" value={form.city} onChange={onChange} required />
              </div>
              <div>
                <Label>State</Label>
                <Input name="state" value={form.state} onChange={onChange} required />
              </div>
              <div>
                <Label>Zip</Label>
                <Input name="zipCode" value={form.zipCode} onChange={onChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input name="phone" value={form.phone} onChange={onChange} />
              </div>
              <div>
                <Label>Website</Label>
                <Input name="website" value={form.website} onChange={onChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Photo URL</Label>
                <Input name="photoUrl" value={form.photoUrl} onChange={onChange} />
              </div>
              <div>
                <Label>County</Label>
                <Input name="county" value={form.county} onChange={onChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} />
                <Label className="font-normal">Active</Label>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" name="sortOrder" value={form.sortOrder} onChange={onChange} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

