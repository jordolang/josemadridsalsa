'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Save, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Status = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'

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

function toLocalDatetimeInput(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function PostEditor({ initial = {}, series, categories, mode }: PostEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    seriesId: initial.seriesId ?? '',
    seriesOrder: initial.seriesOrder ?? '',
    categoryId: initial.categoryId ?? '',
  })

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
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
        seriesId: form.seriesId || null,
        seriesOrder: form.seriesOrder === '' ? null : Number(form.seriesOrder),
        categoryId: form.categoryId || null,
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
          <label className="block text-sm font-semibold mb-1.5">Content (Markdown)</label>
          <Textarea
            value={form.content}
            onChange={(e) => update('content', e.target.value)}
            rows={24}
            className="font-mono text-sm"
            placeholder="# Heading&#10;&#10;Write the post in Markdown..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Cover image URL</label>
          <Input
            value={form.coverImage}
            onChange={(e) => update('coverImage', e.target.value)}
            placeholder="https://... or /images/..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Cover image alt text</label>
          <Input
            value={form.coverImageAlt}
            onChange={(e) => update('coverImageAlt', e.target.value)}
            placeholder="Describe the image for screen readers"
          />
        </div>

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
                <a href={`/heat-index/${initial.slug}`} target="_blank" rel="noopener noreferrer">
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
