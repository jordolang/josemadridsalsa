'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MediaPicker } from './media-picker'

export type ResourceFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'image'
  | 'datetime'
  | 'paths'

export interface ResourceField {
  name: string
  label: string
  type: ResourceFieldType
  help?: string
  options?: { value: string; label: string }[]
  placeholder?: string
}

export type ResourceRecord = Record<string, unknown>

export interface ResourceColumn {
  name: string
  label: string
  render?: (row: ResourceRecord) => React.ReactNode
}

interface ResourceManagerProps {
  title: string
  description: string
  /** Collection endpoint, e.g. `/api/admin/cms/banners`. */
  endpoint: string
  /** Key holding the array in the list response. */
  collectionKey: string
  columns: ResourceColumn[]
  fields: ResourceField[]
  defaults: ResourceRecord
  addLabel?: string
  emptyMessage?: string
}

/** Convert a Date/ISO value into the `datetime-local` input format. */
function toLocalInput(value: unknown): string {
  if (!value || typeof value !== 'string') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/**
 * Table + dialog CRUD screen shared by the simple CMS resources (banners,
 * announcements, FAQs, redirects, reusable sections). Each screen supplies its
 * columns and form fields; everything else — fetching, validation errors,
 * optimistic reload, delete confirmation — behaves identically.
 */
export function ResourceManager({
  title,
  description,
  endpoint,
  collectionKey,
  columns,
  fields,
  defaults,
  addLabel = 'New',
  emptyMessage = 'Nothing here yet.',
}: ResourceManagerProps) {
  const [rows, setRows] = useState<ResourceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ResourceRecord | null>(null)
  const [form, setForm] = useState<ResourceRecord>(defaults)
  const [deleteTarget, setDeleteTarget] = useState<ResourceRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`Failed to load ${title.toLowerCase()}`)
      const data = await response.json()
      setRows(data[collectionKey] ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [endpoint, collectionKey, title])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(defaults)
  }

  function openEdit(row: ResourceRecord) {
    setEditing(row)
    const next: ResourceRecord = { ...defaults }
    for (const field of fields) {
      const value = row[field.name]
      next[field.name] =
        field.type === 'datetime' ? toLocalInput(value) : (value ?? defaults[field.name])
    }
    setForm(next)
  }

  const [showDialog, setShowDialog] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const payload: ResourceRecord = {}
      for (const field of fields) {
        const value = form[field.name]
        if (field.type === 'datetime') {
          payload[field.name] = value ? new Date(value as string).toISOString() : null
        } else if (field.type === 'number') {
          payload[field.name] = Number(value ?? 0)
        } else if (field.type === 'paths') {
          payload[field.name] =
            typeof value === 'string'
              ? value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
              : (value ?? [])
        } else {
          payload[field.name] = value ?? null
        }
      }

      const isEdit = Boolean(editing?.id)
      const response = await fetch(
        isEdit ? `${endpoint}/${editing!.id}` : endpoint,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Save failed')

      toast.success(isEdit ? `${title} updated` : `${title} created`)
      setShowDialog(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id) return
    try {
      const response = await fetch(`${endpoint}/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Delete failed')
      toast.success('Deleted')
      setDeleteTarget(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  const body = useMemo(() => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length + 1} className="py-10 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          </TableCell>
        </TableRow>
      )
    }
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={columns.length + 1}
            className="py-10 text-center text-muted-foreground"
          >
            {emptyMessage}
          </TableCell>
        </TableRow>
      )
    }
    return rows.map((row) => (
      <TableRow key={String(row.id)}>
        {columns.map((column) => (
          <TableCell key={column.name}>
            {column.render ? column.render(row) : String(row[column.name] ?? '—')}
          </TableCell>
        ))}
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              openEdit(row)
              setShowDialog(true)
            }}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row)}>
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">Delete</span>
          </Button>
        </TableCell>
      </TableRow>
    ))
  }, [loading, rows, columns, emptyMessage])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button
          onClick={() => {
            openCreate()
            setShowDialog(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.name}>{column.label}</TableHead>
              ))}
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${title.toLowerCase()}` : `New ${title.toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {fields.map((field) => {
              const value = form[field.name]
              const id = `field-${field.name}`
              return (
                <div key={field.name} className="space-y-2">
                  {field.type !== 'boolean' && field.type !== 'image' && (
                    <Label htmlFor={id}>{field.label}</Label>
                  )}

                  {field.type === 'text' && (
                    <Input
                      id={id}
                      value={String(value ?? '')}
                      placeholder={field.placeholder}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    />
                  )}

                  {field.type === 'textarea' && (
                    <Textarea
                      id={id}
                      rows={4}
                      value={String(value ?? '')}
                      placeholder={field.placeholder}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    />
                  )}

                  {field.type === 'paths' && (
                    <Textarea
                      id={id}
                      rows={3}
                      value={Array.isArray(value) ? value.join('\n') : String(value ?? '')}
                      placeholder={field.placeholder ?? '/products\n/fundraising'}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    />
                  )}

                  {field.type === 'number' && (
                    <Input
                      id={id}
                      type="number"
                      value={String(value ?? 0)}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    />
                  )}

                  {field.type === 'datetime' && (
                    <Input
                      id={id}
                      type="datetime-local"
                      value={String(value ?? '')}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    />
                  )}

                  {field.type === 'select' && (
                    <Select
                      value={String(value ?? '')}
                      onValueChange={(next) => setForm({ ...form, [field.name]: next })}
                    >
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
                  )}

                  {field.type === 'boolean' && (
                    <div className="flex items-center gap-3">
                      <Switch
                        id={id}
                        checked={Boolean(value)}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, [field.name]: checked })
                        }
                      />
                      <Label htmlFor={id}>{field.label}</Label>
                    </div>
                  )}

                  {field.type === 'image' && (
                    <MediaPicker
                      label={field.label}
                      value={String(value ?? '')}
                      onChange={(url) => setForm({ ...form, [field.name]: url })}
                    />
                  )}

                  {field.help && (
                    <p className="text-xs text-muted-foreground">{field.help}</p>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the site immediately and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
