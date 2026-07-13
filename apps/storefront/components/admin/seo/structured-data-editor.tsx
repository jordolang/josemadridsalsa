'use client'

import { useCallback, useEffect, useState } from 'react'
import { Braces, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ENTITY_TYPES = ['ORGANIZATION', 'PRODUCT', 'RECIPE', 'LOCATION', 'EVENT'] as const

interface StructuredDataEntry {
  id: string
  entityType: string
  entityId: string
  schemaType: string
  jsonLd: unknown
  isActive: boolean
  updatedAt: string
}

interface EditorState {
  id?: string
  entityType: string
  entityId: string
  jsonText: string
  isActive: boolean
}

const EMPTY_EDITOR: EditorState = {
  entityType: 'ORGANIZATION',
  entityId: 'site',
  jsonText: '',
  isActive: true,
}

export function StructuredDataEditor() {
  const [entries, setEntries] = useState<StructuredDataEntry[]>([])
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/seo/structured-data')
      if (response.ok) {
        const data = await response.json()
        setEntries(data.entries || [])
      }
    } catch (err) {
      console.error('Failed to fetch structured data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  function openEntry(entry: StructuredDataEntry) {
    setError(null)
    setEditor({
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      jsonText: JSON.stringify(entry.jsonLd, null, 2),
      isActive: entry.isActive,
    })
  }

  async function generateDefault() {
    if (!editor) return
    setGenerating(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        entityType: editor.entityType,
        entityId: editor.entityId,
      })
      const response = await fetch(`/api/admin/seo/structured-data/generate?${params}`)
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to generate schema')
        return
      }
      setEditor({ ...editor, jsonText: JSON.stringify(data.jsonLd, null, 2) })
    } catch (err) {
      setError(String(err))
    } finally {
      setGenerating(false)
    }
  }

  async function saveEntry() {
    if (!editor) return
    setError(null)

    let jsonLd: unknown
    try {
      jsonLd = JSON.parse(editor.jsonText)
    } catch {
      setError('Invalid JSON — fix the syntax before saving.')
      return
    }
    if (typeof jsonLd !== 'object' || jsonLd === null || Array.isArray(jsonLd)) {
      setError('JSON-LD must be a JSON object.')
      return
    }
    if (typeof (jsonLd as Record<string, unknown>)['@type'] !== 'string') {
      setError('JSON-LD must include an "@type" field (e.g. "Product", "Organization").')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/seo/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: editor.entityType,
          entityId: editor.entityId.trim(),
          jsonLd,
          isActive: editor.isActive,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to save')
        return
      }
      setEditor(null)
      await fetchEntries()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('Delete this structured data entry? The page will fall back to its auto-generated schema.')) {
      return
    }
    try {
      const response = await fetch(`/api/admin/seo/structured-data?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        if (editor?.id === id) setEditor(null)
        await fetchEntries()
      }
    } catch (err) {
      console.error('Failed to delete structured data:', err)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Braces className="h-5 w-5" />
          Structured Data (Schema.org)
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setError(null)
              setEditor({ ...EMPTY_EDITOR })
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Product pages and the home page emit auto-generated JSON-LD. Entries here override the
        auto-generated schema for a specific entity. Use entity ID <code>site</code> for the
        Organization schema; for products use the product ID.
      </p>

      {editor && (
        <div className="mb-6 space-y-4 rounded-lg border border-border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select
                value={editor.entityType}
                onValueChange={(value) =>
                  setEditor({
                    ...editor,
                    entityType: value,
                    entityId: value === 'ORGANIZATION' ? 'site' : editor.entityId,
                  })
                }
                disabled={Boolean(editor.id)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sd-entity-id">Entity ID</Label>
              <Input
                id="sd-entity-id"
                value={editor.entityId}
                onChange={(e) => setEditor({ ...editor, entityId: e.target.value })}
                placeholder={editor.entityType === 'ORGANIZATION' ? 'site' : 'Record ID (e.g. product ID)'}
                disabled={Boolean(editor.id)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sd-json">JSON-LD</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateDefault}
                disabled={generating || !editor.entityId}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {generating ? 'Generating…' : 'Generate Default'}
              </Button>
            </div>
            <Textarea
              id="sd-json"
              value={editor.jsonText}
              onChange={(e) => setEditor({ ...editor, jsonText: e.target.value })}
              rows={14}
              className="font-mono text-sm"
              placeholder='{"@context": "https://schema.org", "@type": "Organization", "name": "..."}'
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="sd-active"
              checked={editor.isActive}
              onCheckedChange={(checked) => setEditor({ ...editor, isActive: checked })}
            />
            <Label htmlFor="sd-active">Active (inactive entries fall back to auto-generated schema)</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={saveEntry} disabled={saving || !editor.entityId.trim()}>
              {saving ? 'Saving…' : 'Save Entry'}
            </Button>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading entries…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom entries yet — all pages use their auto-generated schema.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-4 p-3">
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => openEntry(entry)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{entry.schemaType}</span>
                  <Badge variant="outline">{entry.entityType}</Badge>
                  {!entry.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.entityId} · updated {new Date(entry.updatedAt).toLocaleDateString()}
                </p>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteEntry(entry.id)}
                aria-label="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
