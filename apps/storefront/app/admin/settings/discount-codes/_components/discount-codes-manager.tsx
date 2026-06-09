'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  createDiscountCode,
  deleteDiscountCode,
  toggleDiscountCode,
  updateDiscountCode,
} from '../actions'

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'

const DISCOUNT_TYPES: DiscountType[] = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']

export interface DiscountCodeRow {
  id: string
  code: string
  description: string | null
  type: DiscountType
  value: string
  maxUses: number | null
  usedCount: number
  maxUsesPerUser: number | null
  minPurchase: string | null
  startsAt: string | null
  expiresAt: string | null
  isActive: boolean
}

interface Props {
  codes: DiscountCodeRow[]
  canWrite: boolean
}

const TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Percentage',
  FIXED_AMOUNT: 'Fixed amount',
  FREE_SHIPPING: 'Free shipping',
}

function formatValue(type: DiscountType, value: string): string {
  if (type === 'PERCENTAGE') return `${value}%`
  if (type === 'FIXED_AMOUNT') return `$${value}`
  return 'Free shipping'
}

function dateInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // datetime-local expects local wall time as YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

export function DiscountCodesManager({ codes, canWrite }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogState, setDialogState] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; code: DiscountCodeRow }
  >({ mode: 'closed' })
  const [rowError, setRowError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogType, setDialogType] = useState<DiscountType>('PERCENTAGE')
  const [dialogActive, setDialogActive] = useState<boolean>(true)

  const open = dialogState.mode !== 'closed'
  const editing = dialogState.mode === 'edit' ? dialogState.code : null

  // Sync controlled fields when the dialog opens.
  useEffect(() => {
    if (dialogState.mode === 'edit') {
      setDialogType(dialogState.code.type)
      setDialogActive(dialogState.code.isActive)
    } else if (dialogState.mode === 'create') {
      setDialogType('PERCENTAGE')
      setDialogActive(true)
    }
  }, [dialogState])

  const close = () => {
    setDialogState({ mode: 'closed' })
    setDialogError(null)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setDialogError(null)
    const formData = new FormData(e.currentTarget)
    // Radix Select / Switch don't post values via FormData; mirror them here.
    formData.set('type', dialogType)
    formData.set('isActive', dialogActive ? 'true' : 'false')

    startTransition(async () => {
      const result = editing
        ? await updateDiscountCode(editing.id, formData)
        : await createDiscountCode(formData)

      if ('error' in result) {
        setDialogError(result.error)
        return
      }
      close()
      router.refresh()
    })
  }

  const handleToggle = (row: DiscountCodeRow, next: boolean) => {
    setRowError(null)
    startTransition(async () => {
      const result = await toggleDiscountCode(row.id, next)
      if ('error' in result) {
        setRowError(result.error)
        return
      }
      router.refresh()
    })
  }

  const handleDelete = (row: DiscountCodeRow) => {
    if (
      !confirm(
        `Delete discount code "${row.code}"? This cannot be undone.`,
      )
    ) {
      return
    }
    setRowError(null)
    startTransition(async () => {
      const result = await deleteDiscountCode(row.id)
      if ('error' in result) {
        setRowError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-end">
        {canWrite && (
          <Button onClick={() => setDialogState({ mode: 'create' })}>
            <Plus className="mr-2 h-4 w-4" />
            New Discount Code
          </Button>
        )}
      </div>

      {rowError && (
        <Alert variant="destructive">
          <AlertDescription>{rowError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No discount codes yet. Create one to use it in email campaigns.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Code</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Value</th>
                    <th className="px-2 py-2 text-left">Used</th>
                    <th className="px-2 py-2 text-left">Expires</th>
                    <th className="px-2 py-2 text-left">Active</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <div className="font-mono font-semibold">{c.code}</div>
                        {c.description && (
                          <div className="text-xs text-muted-foreground">
                            {c.description}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline">{TYPE_LABELS[c.type]}</Badge>
                      </td>
                      <td className="px-2 py-2">{formatValue(c.type, c.value)}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {c.usedCount}
                        {c.maxUses ? ` / ${c.maxUses}` : ''}
                      </td>
                      <td className="px-2 py-2">
                        {c.expiresAt
                          ? new Date(c.expiresAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <Switch
                          checked={c.isActive}
                          onCheckedChange={(v) => handleToggle(c, v)}
                          disabled={!canWrite || isPending}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDialogState({ mode: 'edit', code: c })
                            }
                            disabled={!canWrite}
                            aria-label={`Edit ${c.code}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(c)}
                            disabled={!canWrite || isPending}
                            aria-label={`Delete ${c.code}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.code}` : 'New discount code'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  name="code"
                  required
                  defaultValue={editing?.code ?? ''}
                  placeholder="SAVE20"
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={dialogType}
                  onValueChange={(v) => setDialogType(v as DiscountType)}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description ?? ''}
                placeholder="Internal note (e.g. April newsletter)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="value">Value *</Label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={editing?.value ?? ''}
                  placeholder="20"
                />
                <p className="text-xs text-muted-foreground">
                  Percent (e.g. 20) or dollar amount (e.g. 5.00).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minPurchase">Min purchase</Label>
                <Input
                  id="minPurchase"
                  name="minPurchase"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing?.minPurchase ?? ''}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="maxUses">Max uses</Label>
                <Input
                  id="maxUses"
                  name="maxUses"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={editing?.maxUses ?? ''}
                  placeholder="unlimited"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxUsesPerUser">Max uses per user</Label>
                <Input
                  id="maxUsesPerUser"
                  name="maxUsesPerUser"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={editing?.maxUsesPerUser ?? ''}
                  placeholder="unlimited"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startsAt">Starts at</Label>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={dateInputValue(editing?.startsAt ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">Expires at</Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="datetime-local"
                  defaultValue={dateInputValue(editing?.expiresAt ?? null)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={dialogActive}
                onCheckedChange={setDialogActive}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            {dialogError && (
              <Alert variant="destructive">
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create code'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
