'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ArrowUpDown, Shield, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import type { ArenaTeam } from '@/lib/arena/server-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type SortKey = 'rank' | 'name' | 'raised' | 'hpPct' | 'shield' | 'attacks'
type SortDir = 'asc' | 'desc'

interface LeaderboardTableProps {
  teams: ArenaTeam[]
  className?: string
}

interface Row {
  team: ArenaTeam
  hpPct: number
  shielded: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function compareRows(
  a: Row,
  b: Row,
  key: SortKey,
  dir: SortDir,
): number {
  const mult = dir === 'asc' ? 1 : -1
  switch (key) {
    case 'rank':
      return mult * (b.team.salesCount - a.team.salesCount)
    case 'name':
      return mult * a.team.name.localeCompare(b.team.name)
    case 'raised':
      return mult * (a.team.raised - b.team.raised)
    case 'hpPct':
      return mult * (a.hpPct - b.hpPct)
    case 'shield':
      return mult * ((a.shielded ? 1 : 0) - (b.shielded ? 1 : 0))
    case 'attacks':
      return mult * (a.team.salesCount - b.team.salesCount)
  }
}

export function LeaderboardTable({
  teams,
  className,
}: LeaderboardTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const baseRanks = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.salesCount - a.salesCount)
    const rankById = new Map<string, number>()
    sorted.forEach((t, i) => rankById.set(t.id, i + 1))
    return rankById
  }, [teams])

  const rows = useMemo<Row[]>(() => {
    const raw: Row[] = teams.map((t) => ({
      team: t,
      hpPct: t.hpMax > 0 ? (t.hpCurrent / t.hpMax) * 100 : 0,
      shielded: Boolean(t.activeShield),
    }))
    return raw.sort((a, b) => compareRows(a, b, sortKey, sortDir))
  }, [teams, sortKey, sortDir])

  function toggleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  if (teams.length === 0) return null

  return (
    <section
      className={clsx(
        'mx-auto mt-10 max-w-6xl rounded-lg border border-neutral-800 bg-black/40',
        className,
      )}
      aria-label="Arena leaderboard"
    >
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
          Leaderboard
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          {teams.length} teams
        </span>
      </header>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-neutral-800 hover:bg-transparent">
              <SortableHead
                label="Rank"
                active={sortKey === 'rank'}
                dir={sortDir}
                onClick={() => toggleSort('rank')}
                className="w-16"
              />
              <SortableHead
                label="Team"
                active={sortKey === 'name'}
                dir={sortDir}
                onClick={() => toggleSort('name')}
              />
              <SortableHead
                label="Raised"
                active={sortKey === 'raised'}
                dir={sortDir}
                onClick={() => toggleSort('raised')}
                align="right"
              />
              <SortableHead
                label="HP"
                active={sortKey === 'hpPct'}
                dir={sortDir}
                onClick={() => toggleSort('hpPct')}
                align="right"
              />
              <SortableHead
                label="Shield"
                active={sortKey === 'shield'}
                dir={sortDir}
                onClick={() => toggleSort('shield')}
                align="center"
              />
              <SortableHead
                label="Attacks"
                active={sortKey === 'attacks'}
                dir={sortDir}
                onClick={() => toggleSort('attacks')}
                align="right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <LeaderboardRow
                key={row.team.id}
                row={row}
                rank={baseRanks.get(row.team.id) ?? 0}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function SortableHead({
  label,
  active,
  dir,
  onClick,
  align = 'left',
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={clsx(
        'h-10 border-neutral-800 bg-black/50 font-mono text-[10px] uppercase tracking-widest text-neutral-400',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'flex w-full items-center gap-1 transition-colors hover:text-amber-300',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center',
          active && 'text-amber-300',
        )}
        aria-sort={
          active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  )
}

function LeaderboardRow({ row, rank }: { row: Row; rank: number }) {
  const { team, hpPct, shielded } = row
  const nearKo = hpPct > 0 && hpPct < 15
  const dead = hpPct === 0

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={clsx(
        'border-neutral-800 font-mono text-xs text-slate-200 transition-colors',
        shielded &&
          'bg-cyan-500/[0.06] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]',
        nearKo && 'animate-pulse bg-red-500/[0.08]',
        dead && 'opacity-60',
      )}
    >
      <TableCell className="w-16 font-bold tabular-nums">
        <span
          className={clsx(
            'inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded px-1.5',
            rank === 1 && 'bg-amber-400/20 text-amber-300',
            rank === 2 && 'bg-slate-400/20 text-slate-200',
            rank === 3 && 'bg-orange-500/20 text-orange-300',
            rank > 3 && 'text-neutral-500',
          )}
        >
          #{rank}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: team.teamColor }}
          />
          <div className="min-w-0">
            <div className="truncate font-sans text-sm font-semibold text-white">
              {team.name}
            </div>
            <div className="truncate text-[10px] uppercase tracking-widest text-neutral-500">
              {team.school}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="font-sans text-sm font-semibold text-emerald-300">
          {formatCurrency(team.raised)}
        </div>
        <div className="text-[10px] text-neutral-500">
          / {formatCurrency(team.goalAmount)}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div
          className={clsx(
            'font-sans text-sm font-semibold',
            dead
              ? 'text-red-500'
              : nearKo
                ? 'text-red-400'
                : hpPct < 50
                  ? 'text-amber-300'
                  : 'text-emerald-300',
          )}
        >
          {dead ? 'KO' : `${Math.round(hpPct)}%`}
        </div>
        <div className="text-[10px] text-neutral-500">
          {team.hpCurrent.toLocaleString()} / {team.hpMax.toLocaleString()}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {shielded ? (
          <Badge className="border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20">
            <Shield className="mr-1 h-3 w-3" />
            Active
          </Badge>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-neutral-600">
            —
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="inline-flex items-center gap-1 font-sans text-sm font-semibold text-amber-200">
          <Zap className="h-3 w-3 text-amber-400" />
          {team.salesCount.toLocaleString()}
        </div>
      </TableCell>
    </motion.tr>
  )
}
