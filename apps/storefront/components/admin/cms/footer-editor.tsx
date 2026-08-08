'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

const SOCIAL_PLATFORMS = ['Facebook', 'Instagram', 'X', 'TikTok', 'YouTube', 'Google'] as const

interface FooterForm {
  aboutText: string
  tagline: string
  copyrightText: string
  newsletterHeading: string
  newsletterBody: string
  contactEmail: string
  contactPhone: string
  addressLines: string
  socialLinks: Record<string, string>
}

const EMPTY: FooterForm = {
  aboutText: '',
  tagline: '',
  copyrightText: '',
  newsletterHeading: '',
  newsletterBody: '',
  contactEmail: '',
  contactPhone: '',
  addressLines: '',
  socialLinks: {},
}

/** Editor for the non-link parts of the footer; its columns live in Navigation. */
export function FooterEditor() {
  const [form, setForm] = useState<FooterForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/admin/cms/footer')
        if (!response.ok) throw new Error('Could not load footer settings')
        const { settings } = await response.json()
        if (settings) {
          setForm({
            aboutText: settings.aboutText ?? '',
            tagline: settings.tagline ?? '',
            copyrightText: settings.copyrightText ?? '',
            newsletterHeading: settings.newsletterHeading ?? '',
            newsletterBody: settings.newsletterBody ?? '',
            contactEmail: settings.contactEmail ?? '',
            contactPhone: settings.contactPhone ?? '',
            addressLines: (settings.addressLines ?? []).join('\n'),
            socialLinks: settings.socialLinks ?? {},
          })
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not load footer settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/cms/footer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aboutText: form.aboutText || null,
          tagline: form.tagline || null,
          copyrightText: form.copyrightText || null,
          newsletterHeading: form.newsletterHeading || null,
          newsletterBody: form.newsletterBody || null,
          contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null,
          addressLines: form.addressLines
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          socialLinks: Object.fromEntries(
            Object.entries(form.socialLinks).filter(([, href]) => href.trim() !== '')
          ),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Save failed')
      toast.success('Footer saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">Loading footer settings…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Footer</h1>
          <p className="text-muted-foreground">
            The blurb, contact details, social links and copyright line at the foot of every page.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        The footer&rsquo;s link columns are managed under Navigation, using the Footer menu.
        Anything left blank here keeps the site&rsquo;s built-in wording.
      </p>

      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="aboutText">Company blurb</Label>
          <Textarea
            id="aboutText"
            rows={3}
            value={form.aboutText}
            onChange={(e) => setForm({ ...form, aboutText: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="copyrightText">Copyright line</Label>
          <Input
            id="copyrightText"
            value={form.copyrightText}
            onChange={(e) => setForm({ ...form, copyrightText: e.target.value })}
            placeholder="© 2026 Jose Madrid Salsa. All rights reserved."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input
              id="contactPhone"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="addressLines">Address</Label>
          <Textarea
            id="addressLines"
            rows={2}
            value={form.addressLines}
            onChange={(e) => setForm({ ...form, addressLines: e.target.value })}
            placeholder="601 Putnam Ave&#10;Zanesville, OH 43701"
          />
          <p className="text-xs text-muted-foreground">One line per row.</p>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Social links</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform} className="space-y-2">
              <Label htmlFor={`social-${platform}`}>{platform}</Label>
              <Input
                id={`social-${platform}`}
                value={form.socialLinks[platform] ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    socialLinks: { ...form.socialLinks, [platform]: e.target.value },
                  })
                }
                placeholder={`https://${platform.toLowerCase()}.com/josemadridsalsa`}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
