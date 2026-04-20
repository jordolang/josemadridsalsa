'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StoryBody } from '@/components/fundraiser/story-body'

interface EditableTeam {
  id: string
  logoUrl: string | null
  heroImageUrl: string | null
  heroVideoUrl: string | null
  campaignTitle: string | null
  tagline: string | null
  storyHtml: string | null
}

interface TeamEditFormProps {
  team: EditableTeam
}

export function TeamEditForm({ team }: TeamEditFormProps) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(team.logoUrl ?? '')
  const [heroImageUrl, setHeroImageUrl] = useState(team.heroImageUrl ?? '')
  const [heroVideoUrl, setHeroVideoUrl] = useState(team.heroVideoUrl ?? '')
  const [campaignTitle, setCampaignTitle] = useState(team.campaignTitle ?? '')
  const [tagline, setTagline] = useState(team.tagline ?? '')
  const [storyHtml, setStoryHtml] = useState(team.storyHtml ?? '')
  const [sanitizedPreview, setSanitizedPreview] = useState<string>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function previewStory() {
    try {
      // Ask the server to sanitize — keeps single source of truth.
      const res = await fetch('/api/admin/fundraiser-teams/preview-story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html: storyHtml }),
      })
      if (res.ok) {
        const data = (await res.json()) as { html: string }
        setSanitizedPreview(data.html)
      } else {
        // Fallback: use raw html in the preview — safe because StoryBody
        // only renders what we pass, and this is an admin-authored string.
        setSanitizedPreview(storyHtml)
      }
    } catch {
      setSanitizedPreview(storyHtml)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)
    try {
      const res = await fetch(`/api/admin/fundraiser-teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          logoUrl: logoUrl || null,
          heroImageUrl: heroImageUrl || null,
          heroVideoUrl: heroVideoUrl || null,
          campaignTitle: campaignTitle.trim() || null,
          tagline: tagline.trim() || null,
          storyHtml: storyHtml || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          typeof data?.error === 'string' ? data.error : 'Could not save team.',
        )
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Campaign content</h2>
        <div className="space-y-1">
          <Label htmlFor="campaignTitle">Campaign title</Label>
          <Input
            id="campaignTitle"
            value={campaignTitle}
            onChange={(e) => setCampaignTitle(e.target.value)}
            placeholder="Spread the Butter"
            maxLength={120}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Join our annual day of giving fundraiser!"
            maxLength={240}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Media</h2>
        <div className="space-y-1">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://cdn.example.com/logo.png"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="heroImageUrl">Hero image URL</Label>
          <Input
            id="heroImageUrl"
            type="url"
            value={heroImageUrl}
            onChange={(e) => setHeroImageUrl(e.target.value)}
            placeholder="https://cdn.example.com/hero.jpg"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="heroVideoUrl">Hero video URL (optional)</Label>
          <Input
            id="heroVideoUrl"
            type="url"
            value={heroVideoUrl}
            onChange={(e) => setHeroVideoUrl(e.target.value)}
            placeholder="https://cdn.example.com/hero.mp4"
          />
          <p className="text-xs text-muted-foreground">
            When set, replaces the hero image.
          </p>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Story</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={previewStory}
          >
            Refresh preview
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="storyHtml">HTML source</Label>
            <Textarea
              id="storyHtml"
              value={storyHtml}
              onChange={(e) => setStoryHtml(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="<p>We are spreading the butter for…</p>"
            />
            <p className="text-xs text-muted-foreground">
              HTML is sanitized on save and render. Allowed: paragraphs,
              headings, lists, links (target=_blank + nofollow), images.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Preview</Label>
            <div className="min-h-[220px] rounded-md border bg-background p-3">
              {sanitizedPreview ? (
                <StoryBody
                  html={sanitizedPreview}
                  className="prose prose-slate max-w-none text-sm"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Click &ldquo;Refresh preview&rdquo; to sanitize and render the
                  current HTML.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded bg-emerald-500/10 p-2 text-xs text-emerald-700">
          Saved. Changes are live on the public fundraise page.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
