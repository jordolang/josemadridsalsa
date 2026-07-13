'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface SeriesRow {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  coverImage: string | null
  accentColor: string | null
  sortOrder: number
  isFeatured: boolean
  postCount: number
}

interface SeriesManagerProps {
  initial: SeriesRow[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function SeriesManager({ initial }: SeriesManagerProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm] = useState({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    accentColor: '#c0392b',
    isFeatured: false,
    coverImage: '',
    sortOrder: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<SeriesRow>>({})

  async function create() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/heat-index/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newForm,
          slug: newForm.slug || slugify(newForm.name),
          coverImage: newForm.coverImage || null,
          tagline: newForm.tagline || null,
          description: newForm.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Create failed')
      toast.success('Series created')
      setCreating(false)
      setNewForm({
        name: '',
        slug: '',
        tagline: '',
        description: '',
        accentColor: '#c0392b',
        isFeatured: false,
        coverImage: '',
        sortOrder: 0,
      })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function save(originalSlug: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/heat-index/series/${originalSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success('Series saved')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(slug: string) {
    if (!confirm('Delete this series? Posts will be detached, not deleted.')) return
    try {
      const res = await fetch(`/api/heat-index/series/${slug}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Delete failed')
      }
      toast.success('Series deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All series ({initial.length})</h2>
        {!creating && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-salsa-600 hover:bg-salsa-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New series
          </Button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border border-salsa-300 bg-salsa-50/50 dark:bg-salsa-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New series</h3>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Name</label>
              <Input
                value={newForm.name}
                onChange={(e) => {
                  setNewForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: f.slug || slugify(e.target.value),
                  }))
                }}
                placeholder="Where is Jose?"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Slug</label>
              <Input
                value={newForm.slug}
                onChange={(e) => setNewForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="where-is-jose"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Tagline</label>
              <Input
                value={newForm.tagline}
                onChange={(e) => setNewForm((f) => ({ ...f, tagline: e.target.value }))}
                placeholder="Following the salsa across America."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Description</label>
              <Textarea
                value={newForm.description}
                onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Accent color</label>
              <Input
                type="color"
                value={newForm.accentColor}
                onChange={(e) => setNewForm((f) => ({ ...f, accentColor: e.target.value }))}
                className="h-10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Cover image URL</label>
              <Input
                value={newForm.coverImage}
                onChange={(e) => setNewForm((f) => ({ ...f, coverImage: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Sort order</label>
              <Input
                type="number"
                value={newForm.sortOrder}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))
                }
              />
            </div>
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={newForm.isFeatured}
                onChange={(e) => setNewForm((f) => ({ ...f, isFeatured: e.target.checked }))}
              />
              Featured on landing
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={submitting || !newForm.name}
              className="bg-salsa-600 hover:bg-salsa-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create series
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
        {initial.map((s) => (
          <li key={s.id} className="p-4">
            {editing === s.id ? (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    value={editForm.name ?? s.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Name"
                  />
                  <Input
                    value={editForm.tagline ?? s.tagline ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, tagline: e.target.value }))
                    }
                    placeholder="Tagline"
                  />
                  <Input
                    type="color"
                    value={editForm.accentColor ?? s.accentColor ?? '#c0392b'}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, accentColor: e.target.value }))
                    }
                    className="h-10"
                  />
                  <Input
                    value={editForm.coverImage ?? s.coverImage ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, coverImage: e.target.value }))
                    }
                    placeholder="Cover image URL"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.isFeatured ?? s.isFeatured}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, isFeatured: e.target.checked }))
                      }
                    />
                    Featured
                  </label>
                </div>
                <Textarea
                  value={editForm.description ?? s.description ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  placeholder="Description"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => save(s.slug)}
                    className="bg-salsa-600 hover:bg-salsa-700 text-white"
                    disabled={submitting}
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span
                  className="block w-1.5 self-stretch rounded-full"
                  style={{ background: s.accentColor ?? '#c0392b' }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{s.name}</p>
                    {s.isFeatured && (
                      <span className="text-[10px] uppercase font-bold tracking-widest rounded-full bg-salsa-100 dark:bg-salsa-900/40 text-salsa-700 dark:text-salsa-300 px-2 py-0.5">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">/heat-index/series/{s.slug}</p>
                  {s.tagline && <p className="text-sm italic mt-1">{s.tagline}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{s.postCount} posts</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(s.id)
                    setEditForm({})
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(s.slug)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
