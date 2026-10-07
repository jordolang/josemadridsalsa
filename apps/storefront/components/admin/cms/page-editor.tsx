'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MediaPicker } from './media-picker'
import { STATUS_OPTIONS } from './status'
import type { BlockField, SerializableBlock } from '@/lib/cms/blocks'

export interface EditorSection {
  /** Stable key: the registry key for system pages, a local id for landing pages. */
  key: string
  /** Block type driving the fields. */
  block: string
  label: string
  description?: string
  required?: boolean
  isVisible: boolean
  data: Record<string, unknown>
}

export interface EditorPage {
  id: string
  slug: string
  title: string
  kind: 'SYSTEM' | 'LANDING'
  status: string
  route: string
  seoTitle: string
  seoDescription: string
  ogImage: string
  canonicalUrl: string
  noIndex: boolean
}

interface PageEditorProps {
  page: EditorPage
  sections: EditorSection[]
  blocks: SerializableBlock[]
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: BlockField
  value: unknown
  onChange: (next: unknown) => void
}) {
  const id = `f-${field.name}`
  switch (field.type) {
    case 'textarea':
    case 'richtext':
      return (
        <Textarea
          id={id}
          rows={field.type === 'richtext' ? 8 : 3}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <Input
          id={id}
          type="number"
          value={String(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )
    case 'boolean':
      return (
        <Input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      )
    case 'select':
      return (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'image':
      return <MediaPicker value={String(value ?? '')} onChange={onChange} />
    default:
      return (
        <Input id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      )
  }
}

/**
 * Page editor for both kinds of page.
 *
 * SYSTEM pages have a fixed set of sections that mirror the hard-coded route —
 * they can be reordered and hidden and their copy replaced, but not added to
 * or removed, because each one maps to real markup. LANDING pages compose
 * freely from the block registry.
 *
 * Leaving a field blank is meaningful: the storefront falls back to the copy it
 * already ships with, so a page that has never been edited looks unchanged.
 */
export function PageEditor({ page, sections: initialSections, blocks }: PageEditorProps) {
  const [meta, setMeta] = useState(page)
  const [sections, setSections] = useState<EditorSection[]>(initialSections)
  const [saving, setSaving] = useState(false)

  const blocksByType = new Map(blocks.map((block) => [block.type, block]))
  const isSystem = page.kind === 'SYSTEM'

  function updateSection(index: number, patch: Partial<EditorSection>) {
    setSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, ...patch } : section))
    )
  }

  function updateField(index: number, field: string, value: unknown) {
    setSections((prev) =>
      prev.map((section, i) =>
        i === index ? { ...section, data: { ...section.data, [field]: value } } : section
      )
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    setSections((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  function addSection(blockType: string) {
    const block = blocksByType.get(blockType)
    if (!block) return
    setSections((prev) => [
      ...prev,
      {
        key: `new-${blockType}-${prev.length}-${Math.random().toString(36).slice(2, 8)}`,
        block: blockType,
        label: block.label,
        isVisible: true,
        data: { ...block.defaults },
      },
    ])
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/cms/pages/${meta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meta.title,
          status: meta.status,
          seoTitle: meta.seoTitle || null,
          seoDescription: meta.seoDescription || null,
          ogImage: meta.ogImage || null,
          canonicalUrl: meta.canonicalUrl || null,
          noIndex: meta.noIndex,
          publishedAt: meta.status === 'PUBLISHED' ? new Date().toISOString() : null,
          sections: sections.map((section, index) => ({
            // System sections keep their registry key so the storefront can
            // look them up; landing sections store their block type.
            type: isSystem ? section.key : section.block,
            sortOrder: index,
            isVisible: section.isVisible,
            data: section.data,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Save failed')
      toast.success('Page saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{meta.title}</h1>
            <Badge variant={isSystem ? 'secondary' : 'outline'}>
              {isSystem ? 'Site page' : 'Landing page'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            <Link href={meta.route} target="_blank" className="inline-flex items-center gap-1 hover:underline">
              {meta.route}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={meta.status} onValueChange={(status) => setMeta({ ...meta, status })}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {isSystem && meta.status !== 'PUBLISHED' && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          This page is not published, so the site is showing its original built-in copy. Set the
          status to Published to make your edits live.
        </p>
      )}

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-6 space-y-3">
          {sections.map((section, index) => {
            const block = blocksByType.get(section.block)
            return (
              <Card key={section.key} className="p-0">
                <Collapsible>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label="Move section up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => move(index, 1)}
                        disabled={index === sections.length - 1}
                        aria-label="Move section down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <CollapsibleTrigger className="flex-1 text-left">
                      <span className="font-medium">{section.label}</span>
                      {section.description && (
                        <span className="block text-xs text-muted-foreground">
                          {section.description}
                        </span>
                      )}
                    </CollapsibleTrigger>

                    {!section.isVisible && <Badge variant="outline">Hidden</Badge>}

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={section.required}
                      title={
                        section.required
                          ? 'This section is structural and cannot be hidden'
                          : section.isVisible
                            ? 'Hide this section'
                            : 'Show this section'
                      }
                      onClick={() => updateSection(index, { isVisible: !section.isVisible })}
                    >
                      {section.isVisible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>

                    {!isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSections((prev) => prev.filter((_, i) => i !== index))
                        }
                        aria-label="Remove section"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-4 border-t px-4 py-4">
                      {block?.fields.map((field) => (
                        <div key={field.name} className="space-y-2">
                          <Label htmlFor={`f-${field.name}`}>{field.label}</Label>
                          <FieldInput
                            field={field}
                            value={section.data[field.name]}
                            onChange={(next) => updateField(index, field.name, next)}
                          />
                          {field.help && (
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                          )}
                        </div>
                      ))}
                      {!block && (
                        <p className="text-sm text-muted-foreground">
                          This section has no editable fields.
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )
          })}

          {!isSystem && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add section
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {blocks
                  .filter((block) => !block.systemOnly)
                  .map((block) => (
                    <DropdownMenuItem key={block.type} onClick={() => addSection(block.type)}>
                      <div>
                        <p className="font-medium">{block.label}</p>
                        <p className="text-xs text-muted-foreground">{block.description}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TabsContent>

        <TabsContent value="seo" className="mt-6">
          <Card className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="seoTitle">Meta title</Label>
              <Input
                id="seoTitle"
                value={meta.seoTitle}
                onChange={(e) => setMeta({ ...meta, seoTitle: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the global template from the SEO manager.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seoDescription">Meta description</Label>
              <Textarea
                id="seoDescription"
                rows={3}
                value={meta.seoDescription}
                onChange={(e) => setMeta({ ...meta, seoDescription: e.target.value })}
              />
            </div>
            <MediaPicker
              label="Social share image"
              value={meta.ogImage}
              onChange={(url) => setMeta({ ...meta, ogImage: url })}
            />
            <div className="space-y-2">
              <Label htmlFor="canonicalUrl">Canonical URL</Label>
              <Input
                id="canonicalUrl"
                value={meta.canonicalUrl}
                onChange={(e) => setMeta({ ...meta, canonicalUrl: e.target.value })}
                placeholder="https://www.josemadridsalsa.com/example"
              />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={meta.noIndex}
                onChange={(e) => setMeta({ ...meta, noIndex: e.target.checked })}
              />
              Hide this page from search engines
            </label>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
