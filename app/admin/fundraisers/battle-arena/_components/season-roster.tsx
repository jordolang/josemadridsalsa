'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RosterTeam {
  id: string
  slug: string
  name: string
  school: string
  status: string
  teamColor: string
  goalAmount: number
  salesCount: number
  hpCurrent: number
  raised: number
}

interface AvailableTeam {
  id: string
  name: string
  school: string
  slug: string
  activePeriod: string
}

interface SeasonRosterProps {
  seasonId: string
  teams: RosterTeam[]
  availableTeams: AvailableTeam[]
  seasonLocked: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function SeasonRoster({
  seasonId,
  teams,
  availableTeams,
  seasonLocked,
}: SeasonRosterProps) {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [pending, setPending] = useState<string | null>(null)

  async function handleAdd(): Promise<void> {
    if (!selectedTeamId) return
    setPending('add')
    try {
      const res = await fetch(
        `/api/admin/arena/seasons/${seasonId}/teams`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ teamId: selectedTeamId }),
        },
      )
      if (res.status === 404) {
        toast.error('Backend endpoint not shipped yet.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error ?? 'Could not add team')
        return
      }
      toast.success('Team added to season.')
      setSelectedTeamId('')
      router.refresh()
    } catch {
      toast.error('Network error.')
    } finally {
      setPending(null)
    }
  }

  async function handleRemove(teamId: string, teamName: string): Promise<void> {
    setPending(teamId)
    try {
      const res = await fetch(
        `/api/admin/arena/seasons/${seasonId}/teams/${teamId}`,
        { method: 'DELETE' },
      )
      if (res.status === 404) {
        toast.error('Backend endpoint not shipped yet.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error ?? 'Could not remove team')
        return
      }
      toast.success(`${teamName} removed from season.`)
      router.refresh()
    } catch {
      toast.error('Network error.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-4">
      {!seasonLocked && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[260px] flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Add team
            </label>
            <Select
              value={selectedTeamId}
              onValueChange={setSelectedTeamId}
              disabled={availableTeams.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    availableTeams.length === 0
                      ? 'No unassigned ACTIVE teams'
                      : 'Select a team…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{' '}
                    <span className="text-muted-foreground">
                      · {t.school} · {t.activePeriod}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAdd}
            disabled={!selectedTeamId || pending !== null}
          >
            {pending === 'add' ? 'Adding…' : 'Add'}
          </Button>
        </Card>
      )}

      {teams.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No teams in this season yet.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Team</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Sales</th>
                <th className="p-3 text-right">Raised</th>
                <th className="p-3 text-right">HP</th>
                {!seasonLocked && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const hpPct =
                  t.goalAmount > 0
                    ? Math.round((t.hpCurrent / t.goalAmount) * 100)
                    : 0
                return (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: t.teamColor }}
                        />
                        <div>
                          <Link
                            href={`/fundraise/${t.slug}`}
                            className="font-semibold hover:underline"
                          >
                            {t.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {t.school}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{t.status}</td>
                    <td className="p-3 text-right tabular-nums">
                      {t.salesCount}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(t.raised)}
                    </td>
                    <td className="p-3 text-right font-mono text-xs tabular-nums">
                      {hpPct}%{' '}
                      <span className="text-muted-foreground">
                        ({t.hpCurrent}/{t.goalAmount})
                      </span>
                    </td>
                    {!seasonLocked && (
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            aria-label={`Edit ${t.name}`}
                          >
                            <Link
                              href={`/admin/fundraisers/battle-arena/teams/${t.id}/edit`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending !== null}
                            onClick={() => handleRemove(t.id, t.name)}
                            aria-label={`Remove ${t.name} from season`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
