'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Save,
  Trash2,
  Eye,
  Image as ImageIcon,
  Bold,
  Italic,
  Heading2,
  List,
  Quote,
  Link2,
  Code,
  Youtube,
  Film,
  Layout,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MediaUploader, MediaPreview } from './media-uploader'
import { SocialCrosspostPanel } from './social-crosspost-panel'

type Status = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
type PostLayout = 'STANDARD' | 'LONGFORM' | 'GALLERY' | 'VIDEO' | 'MINIMAL'

interface SeriesOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
}

export interface PostEditorInitial {
  id?: string
  slug?: string
  title?: string
  subtitle?: string | null
  excerpt?: string
  content?: string
  coverImage?: string | null
  coverImageAlt?: string | null
  status?: Status
  scheduledFor?: string | null
  featured?: boolean
  readingMinutes?: number
  seoTitle?: string | null
  seoDescription?: string | null
  tags?: string[]
  layout?: PostLayout
  galleryImages?: string[]
  videoUrl?: string | null
  seriesId?: string | null
  seriesOrder?: number | null
  categoryId?: string | null
}

interface PostEditorProps {
  initial?: PostEditorInitial
  series: SeriesOption[]
  categories: CategoryOption[]
  mode: 'create' | 'edit'
}

const LAYOUTS: { key: PostLayout; label: string; description: string }[] = [
  { key: 'STANDARD', label: 'Standard', description: 'Cover image, title, prose. The default for most stories.' },
  { key: 'LONGFORM', label: 'Longform', description: 'Larger type, drop cap, magazine-style.' },
  { key: 'GALLERY', label: 'Gallery', description: 'Cover + photo grid above the body. Great for road notes.' },
  { key: 'VIDEO', label: 'Video', description: 'Video hero replaces the cover image.' },
  { key: 'MINIMAL', label: 'Minimal', description: 'No cover, just title + prose. For text-only updates.' },
]

function toLocalDatetimeInput(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(trimmed)) return trimmed
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/watch\?[^"]*v=([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,20})/,
  ]
  for (const re of patterns) {
    const m = trimmed.match(re)
    if (m) return m[1]
  }
  return null
}

function extractVimeoId(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d{6,12}$/.test(trimmed)) return trimmed
  const m = trimmed.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/)
  return m ? m[1] : null
}

export function PostEditor({ initial = {}, series, categories, mode }: PostEditorProps) {
  const router = useRouter()
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [crosspostAccountIds, setCrosspostAccountIds] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [crosspostRefreshKey, setCrosspostRefreshKey] = useState(0)

  const [form, setForm] = useState({
    title: initial.title ?? '',
    subtitle: initial.subtitle ?? '',
    slug: initial.slug ?? '',
    excerpt: initial.excerpt ?? '',
    content: initial.content ?? '',
    coverImage: initial.coverImage ?? '',
    coverImageAlt: initial.coverImageAlt ?? '',
    status: (initial.status ?? 'DRAFT') as Status,
    scheduledFor: toLocalDatetimeInput(initial.scheduledFor),
    featured: initial.featured ?? false,
    readingMinutes: initial.readingMinutes ?? 5,
    seoTitle: initial.seoTitle ?? '',
    seoDescription: initial.seoDescription ?? '',
    tagsCsv: (initial.tags ?? []).join(', '),
    layout: (initial.layout ?? 'STANDARD') as PostLayout,
    galleryImages: initial.galleryImages ?? [],
    videoUrl: initial.videoUrl ?? '',
    seriesId: initial.seriesId ?? '',
    seriesOrder: initial.seriesOrder ?? '',
    categoryId: initial.categoryId ?? '',
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  useEffect(() => {
    const ta = contentRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [form.content])

  function handleContentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = ta.value.slice(0, start) + '  ' + ta.value.slice(end)
      update('content', next)
      setTimeout(() => ta.setSelectionRange(start + 2, start + 2), 0)
    }
  }

  function insertAtCursor(snippet: string) {
    const ta = contentRef.current
    if (!ta) {
      update('content', form.content + snippet)
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = form.content.slice(0, start)
    const selected = form.content.slice(start, end)
    const after = form.content.slice(end)
    const out =
      snippet.includes('$1') && selected
        ? snippet.replace('$1', selected)
        : selected
          ? `${snippet}${selected}`
          : snippet
    const next = `${before}${out}${after}`
    update('content', next)
    setTimeout(() => {
      ta.focus()
      const pos = before.length + out.length
      ta.setSelectionRange(pos, pos)
    }, 0)
  }

  function promptInsertYouTube() {
    const input = prompt('YouTube URL or video ID')
    if (!input) return
    const id = extractYouTubeId(input)
    if (!id) {
      toast.error("Couldn't read that YouTube link")
      return
    }
    insertAtCursor(`\n\n[[youtube:${id}]]\n\n`)
  }

  function promptInsertVimeo() {
    const input = prompt('Vimeo URL or video ID')
    if (!input) return
    const id = extractVimeoId(input)
    if (!id) {
      toast.error("Couldn't read that Vimeo link")
      return
    }
    insertAtCursor(`\n\n[[vimeo:${id}]]\n\n`)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle || null,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt,
        content: form.content,
        coverImage: form.coverImage || null,
        coverImageAlt: form.coverImageAlt || null,
        status: form.status,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
        featured: form.featured,
        readingMinutes: Number(form.readingMinutes) || 5,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        tags: form.tagsCsv
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        layout: form.layout,
        galleryImages: form.galleryImages,
        videoUrl: form.videoUrl || null,
        seriesId: form.seriesId || null,
        seriesOrder: form.seriesOrder === '' ? null : Number(form.seriesOrder),
        categoryId: form.categoryId || null,
        crosspostAccountIds,
      }

      const url =
        mode === 'create'
          ? '/api/heat-index/posts'
          : `/api/heat-index/posts/${initial.slug}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success(mode === 'create' ? 'Post created' : 'Post saved')
      setDirty(false)
      // Auto cross-posting runs server-side on the draft→published transition;
      // bump the key so the panel re-reads per-channel status after the save.
      setCrosspostRefreshKey((k) => k + 1)
      if (mode === 'create') {
        router.push(`/admin/blog/posts/${data.slug}`)
      } else {
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (mode === 'create') return
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/heat-index/posts/${initial.slug}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Delete failed')
      }
      toast.success('Post deleted')
      router.push('/admin/blog/posts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const showGallery = form.layout === 'GALLERY'
  const showVideo = form.layout === 'VIDEO'

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-1.5">Title</label>
          <Input
            value={form.title}
            onChange={(e) => {
              update('title', e.target.value)
              if (mode === 'create' && !form.slug) update('slug', slugify(e.target.value))
            }}
            placeholder="The Y-Bridge Tasting"
            className="text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Subtitle (optional)</label>
          <Input
            value={form.subtitle}
            onChange={(e) => update('subtitle', e.target.value)}
            placeholder="A short, italicized one-liner"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Slug</label>
          <Input
            value={form.slug}
            onChange={(e) => update('slug', e.target.value)}
            placeholder="the-y-bridge-tasting"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Lowercase letters, numbers, and hyphens.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Excerpt</label>
          <Textarea
            value={form.excerpt}
            onChange={(e) => update('excerpt', e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="A 1-3 sentence hook for the listing and metadata."
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label className="block text-sm font-semibold">Content (Markdown)</label>
            <div className="flex flex-wrap gap-1 text-xs">
              <ToolbarButton title="Bold (**)" onClick={() => insertAtCursor('**$1**')}>
                <Bold className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton title="Italic (*)" onClick={() => insertAtCursor('*$1*')}>
                <Italic className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton title="Heading" onClick={() => insertAtCursor('\n## $1\n')}>
                <Heading2 className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton title="Bullet list" onClick={() => insertAtCursor('\n- $1\n')}>
                <List className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton title="Blockquote" onClick={() => insertAtCursor('\n> $1\n')}>
                <Quote className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Link"
                onClick={() => {
                  const href = prompt('URL') ?? ''
                  if (!href) return
                  insertAtCursor(`[$1](${href})`)
                }}
              >
                <Link2 className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton title="Code block" onClick={() => insertAtCursor('\n```\n$1\n```\n')}>
                <Code className="w-3.5 h-3.5" />
              </ToolbarButton>
              <span className="w-px bg-border mx-1" />
              <MediaUploader
                variant="inline"
                accept="image/*,video/*"
                label="Insert media"
                onUploaded={(r) => {
                  const alt = r.filename.replace(/\.[^.]+$/, '')
                  const snippet = r.isVideo
                    ? `\n\n[[video:${r.url}]]\n\n`
                    : `\n\n![${alt}](${r.url})\n\n`
                  insertAtCursor(snippet)
                }}
              />
              <ToolbarButton title="YouTube embed" onClick={promptInsertYouTube}>
                <Youtube className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton title="Vimeo embed" onClick={promptInsertVimeo}>
                <Film className="w-3.5 h-3.5" />
              </ToolbarButton>
            </div>
          </div>
          <Textarea
            ref={contentRef}
            value={form.content}
            onChange={(e) => update('content', e.target.value)}
            onKeyDown={handleContentKeyDown}
            className="font-mono text-sm leading-relaxed min-h-[520px] resize-y overflow-hidden"
            placeholder="# Heading&#10;&#10;Write the post in Markdown. Use the toolbar above to insert images, video, and embeds."
          />
          <p className="text-xs text-muted-foreground mt-1">
            Embeds: <code>[[youtube:ID]]</code>, <code>[[vimeo:ID]]</code>,{' '}
            <code>[[video:https://...]]</code>. Images and videos uploaded via the toolbar go to
            Vercel Blob.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Cover image</label>
          <div className="flex gap-2">
            <Input
              value={form.coverImage}
              onChange={(e) => update('coverImage', e.target.value)}
              placeholder="https://... or paste a URL"
            />
            <MediaUploader
              accept="image/*"
              label="Upload"
              onUploaded={(r) => {
                update('coverImage', r.url)
                if (!form.coverImageAlt) {
                  update('coverImageAlt', r.filename.replace(/\.[^.]+$/, ''))
                }
              }}
            />
          </div>
          {form.coverImage && (
            <div className="mt-2 max-w-sm">
              <MediaPreview
                url={form.coverImage}
                alt={form.coverImageAlt}
                onRemove={() => update('coverImage', '')}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Cover image alt text</label>
          <Input
            value={form.coverImageAlt}
            onChange={(e) => update('coverImageAlt', e.target.value)}
            placeholder="Describe the image for screen readers"
          />
        </div>

        {showGallery && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Gallery images
                </h3>
                <p className="text-xs text-muted-foreground">
                  Shown as a grid above the prose. Up to 24.
                </p>
              </div>
              <MediaUploader
                accept="image/*"
                label="Add images"
                onUploaded={(r) => {
                  if (form.galleryImages.length >= 24) {
                    toast.error('Gallery is full (24 max)')
                    return
                  }
                  update('galleryImages', [...form.galleryImages, r.url])
                }}
              />
            </div>
            {form.galleryImages.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">
                No gallery images yet. Upload some.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {form.galleryImages.map((url, idx) => (
                  <MediaPreview
                    key={`${url}-${idx}`}
                    url={url}
                    onRemove={() =>
                      update(
                        'galleryImages',
                        form.galleryImages.filter((_, i) => i !== idx)
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {showVideo && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Film className="w-4 h-4" />
              Hero video
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Replaces the cover image. Use an MP4/WebM URL, or upload one.
            </p>
            <div className="flex gap-2">
              <Input
                value={form.videoUrl}
                onChange={(e) => update('videoUrl', e.target.value)}
                placeholder="https://...mp4"
              />
              <MediaUploader
                accept="video/*"
                label="Upload video"
                onUploaded={(r) => update('videoUrl', r.url)}
              />
            </div>
            {form.videoUrl && (
              <div className="mt-3 max-w-md">
                <MediaPreview url={form.videoUrl} isVideo onRemove={() => update('videoUrl', '')} />
              </div>
            )}
          </div>
        )}

        <details className="rounded-2xl border border-border p-4">
          <summary className="cursor-pointer font-semibold">SEO overrides</summary>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5">SEO title (optional)</label>
              <Input
                value={form.seoTitle}
                onChange={(e) => update('seoTitle', e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">SEO description (optional)</label>
              <Textarea
                value={form.seoDescription}
                onChange={(e) => update('seoDescription', e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
        </details>
      </div>

      {/* Sidebar */}
      <aside className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Publish
          </h3>

          <div>
            <label className="block text-xs font-semibold mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as Status)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Switching to Published sends email to subscribers.
            </p>
          </div>

          {form.status === 'SCHEDULED' && (
            <div>
              <label className="block text-xs font-semibold mb-1">Scheduled for</label>
              <Input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(e) => update('scheduledFor', e.target.value)}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update('featured', e.target.checked)}
            />
            Featured (lands in hero slot)
          </label>

          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <Button
              onClick={save}
              disabled={saving || !form.title || !form.slug}
              className="bg-salsa-600 hover:bg-salsa-700 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {mode === 'create' ? 'Create post' : 'Save changes'}
            </Button>
            {mode === 'edit' && initial.slug && (
              <Button asChild variant="outline" size="sm">
                <a href={`/admin/blog/posts/${initial.slug}/preview`} target="_blank" rel="noopener noreferrer">
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Preview
                </a>
              </Button>
            )}
            {mode === 'edit' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={remove}
                disabled={deleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete post
              </Button>
            )}
          </div>
        </div>

        <SocialCrosspostPanel
          selected={crosspostAccountIds}
          onChange={setCrosspostAccountIds}
          mode={mode}
          postSlug={initial.slug}
          postStatus={form.status}
          dirty={dirty}
          refreshKey={crosspostRefreshKey}
        />

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layout className="w-3.5 h-3.5" />
            Layout
          </h3>
          <div className="grid gap-2">
            {LAYOUTS.map((opt) => (
              <label
                key={opt.key}
                className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
                  form.layout === opt.key
                    ? 'border-salsa-500 bg-salsa-50 dark:bg-salsa-950/30 ring-1 ring-salsa-500'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="layout"
                    value={opt.key}
                    checked={form.layout === opt.key}
                    onChange={() => update('layout', opt.key)}
                    className="accent-salsa-600"
                  />
                  <span className="font-semibold text-sm">{opt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">{opt.description}</p>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Organize
          </h3>
          <div>
            <label className="block text-xs font-semibold mb-1">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => update('categoryId', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">(none)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Series</label>
            <select
              value={form.seriesId}
              onChange={(e) => update('seriesId', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">(none)</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {form.seriesId && (
            <div>
              <label className="block text-xs font-semibold mb-1">Series order</label>
              <Input
                type="number"
                min={0}
                value={form.seriesOrder}
                onChange={(e) => update('seriesOrder', e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1">Reading minutes</label>
            <Input
              type="number"
              min={1}
              value={form.readingMinutes}
              onChange={(e) => update('readingMinutes', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Tags (comma-separated)</label>
            <Input
              value={form.tagsCsv}
              onChange={(e) => update('tagsCsv', e.target.value)}
              placeholder="zanesville, recipe, raspberry-chipotle"
            />
          </div>
        </div>
      </aside>
    </div>
  )
}

interface ToolbarButtonProps {
  title: string
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ title, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 rounded border border-border bg-background hover:bg-muted transition"
    >
      {children}
    </button>
  )
}
