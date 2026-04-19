'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function firstDayOf(period: string): string {
  return `${period}-01`
}

function lastDayOf(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${period}-${String(last).padStart(2, '0')}`
}

export function SeasonForm() {
  const router = useRouter()
  const defaultPeriod = currentPeriod()
  const [period, setPeriod] = useState(defaultPeriod)
  const [startsAt, setStartsAt] = useState(firstDayOf(defaultPeriod))
  const [endsAt, setEndsAt] = useState(lastDayOf(defaultPeriod))
  const [rulesJson, setRulesJson] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validatePeriod(value: string): boolean {
    return /^\d{4}-\d{2}$/.test(value)
  }

  function handlePeriodChange(value: string): void {
    setPeriod(value)
    if (validatePeriod(value)) {
      setStartsAt(firstDayOf(value))
      setEndsAt(lastDayOf(value))
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)

    if (!validatePeriod(period)) {
      setError('Period must be in YYYY-MM format.')
      return
    }

    let parsedRules: unknown = undefined
    if (rulesJson.trim()) {
      try {
        parsedRules = JSON.parse(rulesJson)
      } catch {
        setError('rulesJson must be valid JSON or left blank.')
        return
      }
    }

    setPending(true)
    try {
      const res = await fetch('/api/admin/arena/seasons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          period,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          rulesJson: parsedRules ?? null,
        }),
      })

      if (res.status === 404) {
        setError('Backend endpoint not shipped yet. Try again once @tom ships POST /api/admin/arena/seasons.')
        return
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          typeof data?.error === 'string' ? data.error : 'Could not create season.',
        )
        return
      }

      const seasonId = (data as { id?: string; season?: { id?: string } })
        .id ?? (data as { season?: { id?: string } }).season?.id
      if (seasonId) {
        router.push(`/admin/fundraisers/battle-arena/${seasonId}`)
      } else {
        router.push('/admin/fundraisers/battle-arena')
      }
      router.refresh()
    } catch {
      setError('Network error. Check the dev server and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="period">Period</Label>
            <Input
              id="period"
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              required
            />
            <p className="text-xs text-muted-foreground">
              Must be unique across seasons.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="startsAt">Starts at</Label>
            <Input
              id="startsAt"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endsAt">Ends at</Label>
            <Input
              id="endsAt"
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="rulesJson">Rule overrides (optional JSON)</Label>
          <Textarea
            id="rulesJson"
            value={rulesJson}
            onChange={(e) => setRulesJson(e.target.value)}
            rows={8}
            placeholder={`{\n  "shieldDurationMs": 1800000,\n  "shieldMaxHp": 30,\n  "maxConsecutiveShares": 2,\n  "critDamageThreshold": 50,\n  "bigPurchaseThreshold": 100\n}`}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Missing keys fall back to the module-level constants in{' '}
            <code className="font-mono">lib/arena/rules.ts</code>.
          </p>
        </div>

        {error && (
          <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create season'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
