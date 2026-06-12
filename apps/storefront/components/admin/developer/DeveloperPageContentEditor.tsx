'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DeveloperPageContentData } from '@/lib/developer/page-content'

const SECTION_LABELS: Record<keyof DeveloperPageContentData['sections'], string> = {
  about: 'About / Mission',
  stats: 'Project Stats',
  blog: 'Blog Preview',
  timeline: 'Project Timeline',
  skills: 'Tech Stack',
  changelog: 'Changelog',
  contact: 'Contact Form',
  closing: 'Closing Statement',
}

export function DeveloperPageContentEditor({
  initialContent,
}: {
  initialContent: DeveloperPageContentData
}) {
  const router = useRouter()
  const [content, setContent] = useState<DeveloperPageContentData>(initialContent)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const update = <K extends keyof DeveloperPageContentData>(
    section: K,
    patch: Partial<DeveloperPageContentData[K]>,
  ) => {
    setContent((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/developer/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save content')
      }
      toast.success('Developer page content saved')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save content')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/developer/admin/content', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset content')
      }
      setContent(data.content)
      toast.success('Developer page reset to defaults')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset content')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Customize what visitors see on the public developer page.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/developer" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Preview Page
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleReset()}
            disabled={saving || resetting}
          >
            {resetting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-4 w-4" />
            )}
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || resetting}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section Visibility</CardTitle>
          <CardDescription>Toggle which sections appear on the page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(SECTION_LABELS) as (keyof DeveloperPageContentData['sections'])[]).map(
            (key) => (
              <div key={key} className="flex items-center gap-3">
                <Switch
                  id={`section-${key}`}
                  checked={content.sections[key]}
                  onCheckedChange={(checked) => update('sections', { [key]: checked })}
                />
                <Label htmlFor={`section-${key}`}>{SECTION_LABELS[key]}</Label>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hero</CardTitle>
          <CardDescription>The banner at the top of the page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hero-badge">Badge</Label>
              <Input
                id="hero-badge"
                value={content.hero.badge}
                onChange={(e) => update('hero', { badge: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-heading">Heading</Label>
              <Input
                id="hero-heading"
                value={content.hero.heading}
                onChange={(e) => update('hero', { heading: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-intro">Intro</Label>
            <Textarea
              id="hero-intro"
              rows={3}
              value={content.hero.intro}
              onChange={(e) => update('hero', { intro: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-faith">Faith statement</Label>
            <Textarea
              id="hero-faith"
              rows={3}
              value={content.hero.faithStatement}
              onChange={(e) => update('hero', { faithStatement: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hero-cta-label">Primary CTA label</Label>
              <Input
                id="hero-cta-label"
                value={content.hero.primaryCtaLabel}
                onChange={(e) => update('hero', { primaryCtaLabel: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-cta-href">Primary CTA link</Label>
              <Input
                id="hero-cta-href"
                value={content.hero.primaryCtaHref}
                onChange={(e) => update('hero', { primaryCtaHref: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <Switch
                id="hero-show-faith"
                checked={content.hero.showFaithStatement}
                onCheckedChange={(checked) => update('hero', { showFaithStatement: checked })}
              />
              <Label htmlFor="hero-show-faith">Show faith statement</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="hero-show-photo"
                checked={content.hero.showPhoto}
                onCheckedChange={(checked) => update('hero', { showPhoto: checked })}
              />
              <Label htmlFor="hero-show-photo">Show profile photo</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About / Mission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="about-heading">Heading</Label>
            <Input
              id="about-heading"
              value={content.about.heading}
              onChange={(e) => update('about', { heading: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="about-body">Body</Label>
            <Textarea
              id="about-body"
              rows={6}
              value={content.about.body}
              onChange={(e) => update('about', { body: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; Closing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-heading">Contact heading</Label>
              <Input
                id="contact-heading"
                value={content.contact.heading}
                onChange={(e) => update('contact', { heading: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-description">Contact description</Label>
              <Input
                id="contact-description"
                value={content.contact.description}
                onChange={(e) => update('contact', { description: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="closing-quote">Closing quote</Label>
            <Textarea
              id="closing-quote"
              rows={2}
              value={content.closing.quote}
              onChange={(e) => update('closing', { quote: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closing-cite">Closing citation</Label>
            <Input
              id="closing-cite"
              value={content.closing.cite}
              onChange={(e) => update('closing', { cite: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
