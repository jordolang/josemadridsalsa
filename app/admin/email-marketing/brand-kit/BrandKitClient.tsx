'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, Palette, Globe, Share2 } from 'lucide-react'
import { toast } from 'sonner'

interface BrandKitData {
  id?: string
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  fontFamily?: string | null
  physicalAddress?: string | null
  websiteUrl?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socialLinks?: any
}

function toClientData(initialData: BrandKitData | null): BrandKitData {
  return {
    ...(initialData ?? {}),
    logoUrl: initialData?.logoUrl ?? '',
    primaryColor: initialData?.primaryColor ?? '#000000',
    secondaryColor: initialData?.secondaryColor ?? '#ffffff',
    accentColor: initialData?.accentColor ?? '#e11d48',
    fontFamily: initialData?.fontFamily ?? 'Arial, sans-serif',
    physicalAddress: initialData?.physicalAddress ?? '',
    websiteUrl: initialData?.websiteUrl ?? (typeof window !== 'undefined' ? window.location.origin : ''),
    socialLinks:
      initialData?.socialLinks && typeof initialData.socialLinks === 'object'
        ? (initialData.socialLinks as Record<string, string>)
        : { facebook: '', instagram: '', youtube: '', tiktok: '' },
  }
}

export function BrandKitClient({ initialData }: { initialData: BrandKitData | null }) {
  const [data, setData] = useState<BrandKitData>(toClientData(initialData))
  const [loading, setLoading] = useState(false)

  const update = (field: keyof BrandKitData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  const updateSocial = (platform: string, url: string) => {
    setData((prev) => ({
      ...prev,
      socialLinks: { ...(prev.socialLinks ?? {}), [platform]: url },
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/brand-kit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success('Brand kit saved')
    } catch {
      toast.error('Failed to save brand kit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Colors & Logo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Logo URL</Label>
            <Input value={data.logoUrl ?? ''} onChange={(e) => update('logoUrl', e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((field) => (
              <div key={field}>
                <Label className="capitalize">{field.replace('Color', ' Color')}</Label>
                <div className="flex gap-2">
                  <input type="color" value={data[field] ?? '#000000'} onChange={(e) => update(field, e.target.value)} className="h-10 w-12 rounded cursor-pointer border" />
                  <Input value={data[field] ?? ''} onChange={(e) => update(field, e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label>Font Family</Label>
            <Input value={data.fontFamily ?? ''} onChange={(e) => update('fontFamily', e.target.value)} placeholder="Arial, sans-serif" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Contact & Website</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Website URL</Label>
            <Input value={data.websiteUrl ?? ''} onChange={(e) => update('websiteUrl', e.target.value)} placeholder="https://example.com" />
          </div>
          <div>
            <Label>Physical Address (required for CAN-SPAM compliance)</Label>
            <Textarea value={data.physicalAddress ?? ''} onChange={(e) => update('physicalAddress', e.target.value)} placeholder="123 Main St, City, State, ZIP" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" />Social Media Links</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {['facebook', 'instagram', 'youtube', 'tiktok', 'pinterest'].map((platform) => (
            <div key={platform}>
              <Label className="capitalize">{platform}</Label>
              <Input
                value={(data.socialLinks as Record<string, string>)?.[platform] ?? ''}
                onChange={(e) => updateSocial(platform, e.target.value)}
                placeholder={`https://${platform}.com/josemadridsalsa`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="w-full">
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Brand Kit</>}
      </Button>
    </div>
  )
}
