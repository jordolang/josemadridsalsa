'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface CategoryRow {
  id: string
  slug: string
  name: string
  description: string | null
  accentColor: string | null
  sortOrder: number
  postCount: number
}

function slugify(t: string): string {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

export function CategoriesManager({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    accentColor: '#c0392b',
    sortOrder: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<CategoryRow>>({})

  async function create() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/heat-index/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          slug: form.slug || slugify(form.name),
          description: form.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Create failed')
      toast.success('Category created')
      setCreating(false)
      setForm({ name: '', slug: '', description: '', accentColor: '#c0392b', sortOrder: 0 })
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
      const res = await fetch(`/api/heat-index/categories/${originalSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success('Category saved')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(slug: string) {
    if (!confirm('Delete this category? Posts will be detached.')) return
    try {
      const res = await fetch(`/api/heat-index/categories/${slug}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Delete failed')
      }
      toast.success('Category deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All categories ({initial.length})</h2>
        {!creating && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-salsa-600 hover:bg-salsa-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New category
          </Button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border border-salsa-300 bg-salsa-50/50 dark:bg-salsa-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New category</h3>
            <button onClick={() => setCreating(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))
              }
              placeholder="Name"
            />
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="slug"
            />
            <div className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Description"
              />
            </div>
            <Input
              type="color"
              value={form.accentColor}
              onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
              className="h-10"
            />
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              placeholder="Sort order"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={submitting || !form.name}
              className="bg-salsa-600 hover:bg-salsa-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
        {initial.map((c) => (
          <li key={c.id} className="p-4">
            {editing === c.id ? (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    value={editForm.name ?? c.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <Input
                    type="color"
                    value={editForm.accentColor ?? c.accentColor ?? '#c0392b'}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, accentColor: e.target.value }))
                    }
                    className="h-10"
                  />
                </div>
                <Textarea
                  value={editForm.description ?? c.description ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => save(c.slug)}
                    disabled={submitting}
                    className="bg-salsa-600 hover:bg-salsa-700 text-white"
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
                  style={{ background: c.accentColor ?? '#c0392b' }}
                />
                <div className="flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /heat-index/category/{c.slug}
                  </p>
                  {c.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{c.description}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{c.postCount} posts</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(c.id)
                    setEditForm({})
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(c.slug)}
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
