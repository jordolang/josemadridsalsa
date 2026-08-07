'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, CornerDownRight, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

interface MenuItem {
  id: string
  parentId: string | null
  label: string
  href: string
  description: string
  sortOrder: number
  isVisible: boolean
  openInNewTab: boolean
}

interface MenuEditorProps {
  location: 'HEADER' | 'FOOTER' | 'MOBILE' | 'UTILITY'
  title: string
  description: string
  /** Explains what top-level items mean for this menu. */
  structureHint: string
}

function newId(): string {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Two-level menu builder.
 *
 * The header renders top-level items as dropdown groups and their children as
 * the links inside; the footer renders them as column headings and links. Two
 * levels is all either design supports, so the editor does not offer more.
 */
export function MenuEditor({ location, title, description, structureHint }: MenuEditorProps) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/admin/cms/navigation/${location}`)
        if (!response.ok) throw new Error('Could not load this menu')
        const data = await response.json()
        const loaded = (data.menu?.items ?? []).map(
          (item: Record<string, unknown>): MenuItem => ({
            id: String(item.id),
            parentId: item.parentId ? String(item.parentId) : null,
            label: String(item.label ?? ''),
            href: String(item.href ?? ''),
            description: item.description ? String(item.description) : '',
            sortOrder: Number(item.sortOrder ?? 0),
            isVisible: Boolean(item.isVisible),
            openInNewTab: Boolean(item.openInNewTab),
          })
        )
        setItems(loaded)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not load this menu')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [location])

  const topLevel = items.filter((item) => !item.parentId)
  const childrenOf = (parentId: string) => items.filter((item) => item.parentId === parentId)

  function update(id: string, patch: Partial<MenuItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function remove(id: string) {
    // Removing a group removes the links inside it.
    setItems((prev) => prev.filter((item) => item.id !== id && item.parentId !== id))
  }

  function addTopLevel() {
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        parentId: null,
        label: 'New group',
        href: '/',
        description: '',
        sortOrder: prev.length,
        isVisible: true,
        openInNewTab: false,
      },
    ])
  }

  function addChild(parentId: string) {
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        parentId,
        label: 'New link',
        href: '/',
        description: '',
        sortOrder: prev.filter((i) => i.parentId === parentId).length,
        isVisible: true,
        openInNewTab: false,
      },
    ])
  }

  function moveWithinSiblings(item: MenuItem, direction: -1 | 1) {
    const siblings = items.filter((i) => i.parentId === item.parentId)
    const index = siblings.findIndex((i) => i.id === item.id)
    const target = index + direction
    if (target < 0 || target >= siblings.length) return

    const reordered = [...siblings]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)

    setItems((prev) =>
      prev.map((i) => {
        const position = reordered.findIndex((s) => s.id === i.id)
        return position === -1 ? i : { ...i, sortOrder: position }
      })
    )
  }

  async function save() {
    setSaving(true)
    try {
      // Flatten with parents first so the server can resolve parentId
      // references against ids it has already created.
      const ordered = [
        ...topLevel.sort((a, b) => a.sortOrder - b.sortOrder),
        ...topLevel
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .flatMap((parent) => childrenOf(parent.id).sort((a, b) => a.sortOrder - b.sortOrder)),
      ]

      const response = await fetch(`/api/admin/cms/navigation/${location}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          items: ordered.map((item, index) => ({
            id: item.id,
            parentId: item.parentId,
            label: item.label,
            href: item.href,
            description: item.description || null,
            sortOrder: index,
            isVisible: item.isVisible,
            openInNewTab: item.openInNewTab,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Save failed')

      // Adopt the ids the server assigned so a second save updates in place.
      const saved = (data.menu?.items ?? []).map(
        (item: Record<string, unknown>): MenuItem => ({
          id: String(item.id),
          parentId: item.parentId ? String(item.parentId) : null,
          label: String(item.label ?? ''),
          href: String(item.href ?? ''),
          description: item.description ? String(item.description) : '',
          sortOrder: Number(item.sortOrder ?? 0),
          isVisible: Boolean(item.isVisible),
          openInNewTab: Boolean(item.openInNewTab),
        })
      )
      setItems(saved)
      toast.success('Menu saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">Loading menu…</p>
  }

  function ItemFields({ item }: { item: MenuItem }) {
    return (
      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={item.label}
          onChange={(e) => update(item.id, { label: e.target.value })}
          placeholder="Label"
        />
        <Input
          value={item.href}
          onChange={(e) => update(item.id, { href: e.target.value })}
          placeholder="/products"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={item.isVisible}
            onCheckedChange={(checked) => update(item.id, { isVisible: checked })}
            aria-label="Visible"
          />
          <span className="text-xs text-muted-foreground">Visible</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save menu
        </Button>
      </div>

      <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {structureHint} Leave this menu empty to keep the site&rsquo;s built-in links.
      </p>

      <div className="space-y-4">
        {topLevel
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((parent) => (
            <Card key={parent.id} className="space-y-3 p-4">
              <div className="flex items-start gap-2">
                <div className="flex flex-col pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveWithinSiblings(parent, -1)}
                    aria-label="Move group up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveWithinSiblings(parent, 1)}
                    aria-label="Move group down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <ItemFields item={parent} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(parent.id)}
                  aria-label="Remove group"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-2 pl-8">
                {childrenOf(parent.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((child) => (
                    <div key={child.id} className="flex items-start gap-2">
                      <CornerDownRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <ItemFields item={child} />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(child.id)}
                        aria-label="Remove link"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                <Button variant="ghost" size="sm" onClick={() => addChild(parent.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add link
                </Button>
              </div>
            </Card>
          ))}
      </div>

      <Button variant="outline" onClick={addTopLevel}>
        <Plus className="mr-2 h-4 w-4" />
        Add group
      </Button>
    </div>
  )
}
