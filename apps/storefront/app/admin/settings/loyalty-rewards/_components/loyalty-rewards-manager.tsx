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
import { LOYALTY_TIERS, rewardReturnPercent, type LoyaltyTierName } from '@/lib/loyalty-rewards-schema'
import { deleteRewardAction, saveRewardAction, toggleRewardAction } from '../actions'

export interface RewardRow {
  id: string
  name: string
  description: string
  pointsCost: number
  rewardValue: number
  rewardType: string
  minimumTier: string
  maxRedemptions: number | null
  usedCount: number
  redemptionCount: number
  isActive: boolean
}

interface Props {
  rewards: RewardRow[]
  canWrite: boolean
  pointsPerDollar: number
}

const TIER_LABELS: Record<LoyaltyTierName, string> = {
  BRONZE: 'Bronze (everyone)',
  SILVER: 'Silver+',
  GOLD: 'Gold+',
  PLATINUM: 'Platinum',
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function LoyaltyRewardsManager({ rewards, canWrite, pointsPerDollar }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogState, setDialogState] = useState<
    { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; reward: RewardRow }
  >({ mode: 'closed' })
  const [rowError, setRowError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogTier, setDialogTier] = useState<LoyaltyTierName>('BRONZE')
  const [dialogActive, setDialogActive] = useState(true)
  const [previewPoints, setPreviewPoints] = useState('')
  const [previewValue, setPreviewValue] = useState('')

  const open = dialogState.mode !== 'closed'
  const editing = dialogState.mode === 'edit' ? dialogState.reward : null

  useEffect(() => {
    if (dialogState.mode === 'edit') {
      const { reward } = dialogState
      setDialogTier((LOYALTY_TIERS as readonly string[]).includes(reward.minimumTier)
        ? (reward.minimumTier as LoyaltyTierName)
        : 'BRONZE')
      setDialogActive(reward.isActive)
      setPreviewPoints(String(reward.pointsCost))
      setPreviewValue(String(reward.rewardValue))
    } else if (dialogState.mode === 'create') {
      setDialogTier('BRONZE')
      setDialogActive(true)
      setPreviewPoints('')
      setPreviewValue('')
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
    formData.set('minimumTier', dialogTier)
    formData.set('isActive', dialogActive ? 'true' : 'false')

    startTransition(async () => {
      const result = await saveRewardAction(editing?.id ?? null, formData)
      if ('error' in result) {
        setDialogError(result.error)
        return
      }
      close()
      router.refresh()
    })
  }

  const runRowAction = (action: () => Promise<{ success: true } | { error: string }>) => {
    setRowError(null)
    startTransition(async () => {
      const result = await action()
      if ('error' in result) {
        setRowError(result.error)
        return
      }
      router.refresh()
    })
  }

  const handleDelete = (row: RewardRow) => {
    if (!confirm(`Delete the "${row.name}" reward? This cannot be undone.`)) return
    runRowAction(() => deleteRewardAction(row.id))
  }

  const previewPercent =
    Number(previewPoints) > 0 && Number(previewValue) > 0
      ? rewardReturnPercent(Number(previewPoints), Number(previewValue), pointsPerDollar)
      : null

  return (
    <>
      <div className="flex items-center justify-end">
        {canWrite && (
          <Button onClick={() => setDialogState({ mode: 'create' })}>
            <Plus className="mr-2 h-4 w-4" />
            New Reward
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
          <CardTitle className="text-base">Reward Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rewards yet. Customers can see their points balance, but have nothing to spend it on until you
              add one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Reward</th>
                    <th className="px-2 py-2 text-right">Points</th>
                    <th className="px-2 py-2 text-right">Discount</th>
                    <th className="px-2 py-2 text-right">Return</th>
                    <th className="px-2 py-2 text-left">Tier</th>
                    <th className="px-2 py-2 text-left">Redeemed</th>
                    <th className="px-2 py-2 text-left">Active</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.description}</div>
                        {r.rewardType !== 'DISCOUNT' && (
                          <Badge variant="destructive" className="mt-1">
                            Not redeemable — save it to make it a discount reward
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.pointsCost.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(r.rewardValue)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {rewardReturnPercent(r.pointsCost, r.rewardValue, pointsPerDollar).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline">{r.minimumTier}</Badge>
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {r.usedCount}
                        {r.maxRedemptions ? ` / ${r.maxRedemptions}` : ''}
                      </td>
                      <td className="px-2 py-2">
                        <Switch
                          checked={r.isActive}
                          onCheckedChange={(v) => runRowAction(() => toggleRewardAction(r.id, v))}
                          disabled={!canWrite || isPending}
                          aria-label={`${r.isActive ? 'Deactivate' : 'Activate'} ${r.name}`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialogState({ mode: 'edit', reward: r })}
                            disabled={!canWrite}
                            aria-label={`Edit ${r.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(r)}
                            disabled={!canWrite || isPending || r.redemptionCount > 0}
                            title={r.redemptionCount > 0 ? 'Redeemed rewards can only be switched off' : undefined}
                            aria-label={`Delete ${r.name}`}
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
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'New reward'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required maxLength={100} defaultValue={editing?.name ?? ''} placeholder="$5 Off" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                required
                maxLength={500}
                defaultValue={editing?.description ?? ''}
                placeholder="Get $5 off your next order"
              />
              <p className="text-xs text-muted-foreground">Customers see this on their rewards page.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pointsCost">Points cost *</Label>
                <Input
                  id="pointsCost"
                  name="pointsCost"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={previewPoints}
                  onChange={(e) => setPreviewPoints(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rewardValue">Discount ($) *</Label>
                <Input
                  id="rewardValue"
                  name="rewardValue"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={previewValue}
                  onChange={(e) => setPreviewValue(e.target.value)}
                  placeholder="5.00"
                />
              </div>
            </div>
            {previewPercent !== null && (
              <p className="text-xs text-muted-foreground">
                Gives back about <span className="font-semibold text-foreground">{previewPercent.toFixed(1)}%</span>{' '}
                of what a customer spends to earn it.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="minimumTier">Minimum tier</Label>
                <Select value={dialogTier} onValueChange={(v) => setDialogTier(v as LoyaltyTierName)}>
                  <SelectTrigger id="minimumTier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOYALTY_TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxRedemptions">Total redemption limit</Label>
                <Input
                  id="maxRedemptions"
                  name="maxRedemptions"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={editing?.maxRedemptions ?? ''}
                  placeholder="unlimited"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="isActive" checked={dialogActive} onCheckedChange={setDialogActive} />
              <Label htmlFor="isActive">Active (customers can redeem it)</Label>
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
                {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create reward'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
