'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type DonationFrequency = 'one_time' | 'monthly'

export type DonationTier = {
  amount: number
  label: string
}

export type DonationFund = {
  id: string
  name: string
}

export type DonationFormValues = {
  amount: number
  frequency: DonationFrequency
  fundId: string | null
}

export interface DonationFormProps {
  /** Preset amount tiles, first four shown in a 2×2 grid. */
  tiers: DonationTier[]
  /** Optional funds users can designate their gift to. */
  funds?: DonationFund[]
  /** Default minimum when the user picks "Other". */
  minCustomAmount?: number
  currency?: string
  onSubmit: (values: DonationFormValues) => void | Promise<void>
  className?: string
}

/**
 * Givebutter-style donation form.
 *
 * One-time / Monthly toggle, 2×2 preset tiles, free-form "Other" amount,
 * optional designation Select, and a single Continue CTA. Built entirely
 * with shadcn/ui primitives.
 */
export function DonationForm({
  tiers,
  funds,
  minCustomAmount = 1,
  currency = 'USD',
  onSubmit,
  className,
}: DonationFormProps) {
  const [frequency, setFrequency] = useState<DonationFrequency>('one_time')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(
    tiers[1]?.amount ?? tiers[0]?.amount ?? null,
  )
  const [customAmount, setCustomAmount] = useState('')
  const [fundId, setFundId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const resolvedAmount: number =
    selectedAmount !== null
      ? selectedAmount
      : Number.parseFloat(customAmount) || 0

  const canContinue =
    selectedAmount !== null
      ? selectedAmount > 0
      : resolvedAmount >= minCustomAmount

  async function handleContinue() {
    if (!canContinue) return
    setSubmitting(true)
    try {
      await onSubmit({
        amount: resolvedAmount,
        frequency,
        fundId,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className={cn('w-full max-w-md shadow-xl', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Choose amount</CardTitle>
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
          <ShieldCheck className="h-4 w-4" />
          Secure
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs
          value={frequency}
          onValueChange={(v) => setFrequency(v as DonationFrequency)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="one_time">One-time</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          {tiers.slice(0, 4).map((tier) => {
            const active = selectedAmount === tier.amount
            return (
              <button
                key={tier.amount}
                type="button"
                onClick={() => {
                  setSelectedAmount(tier.amount)
                  setCustomAmount('')
                }}
                className={cn(
                  'flex flex-col items-start rounded-lg border bg-card p-3 text-left transition-all',
                  'hover:border-primary/50 hover:shadow-sm',
                  active &&
                    'border-primary ring-2 ring-primary/30 shadow-md',
                )}
                aria-pressed={active}
              >
                <span className="text-xl font-bold">
                  ${tier.amount.toLocaleString()}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {tier.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Input
            type="number"
            inputMode="decimal"
            min={minCustomAmount}
            step="0.01"
            placeholder="$ Other"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value)
              setSelectedAmount(null)
            }}
            className="pr-12 text-base"
            aria-label="Custom donation amount"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {currency}
          </span>
        </div>

        {funds && funds.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Designate your gift
            </Label>
            <Select
              value={fundId ?? 'none'}
              onValueChange={(v) => setFundId(v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a fund (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Where needed most</SelectItem>
                {funds.map((fund) => (
                  <SelectItem key={fund.id} value={fund.id}>
                    {fund.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!canContinue || submitting}
          onClick={handleContinue}
        >
          {submitting ? 'Processing…' : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  )
}
