'use client'

import { useMemo } from 'react'
import { Shield, Swords } from 'lucide-react'
import { clsx } from 'clsx'
import type { ArenaSnapshot, ArenaTeam } from '@/lib/arena/server-state'
import { useArenaState } from '@/lib/arena/use-arena-state'
import { HpBar } from './hp-bar'
import { ShieldTimer } from './shield-timer'
import { ShieldVisuals } from './shield-visuals'
import { ShareButton } from './share-button'
import { AttackFeed, type AttackFeedItem } from './attack-feed'

interface BattleWidgetProps {
  /** Team viewed in the widget — its id is used to filter the snapshot. */
  team: Pick<
    ArenaTeam,
    | 'id'
    | 'slug'
    | 'name'
    | 'teamColor'
    | 'teamColorDark'
    | 'hpCurrent'
    | 'hpMax'
    | 'activeShield'
  >
  period: string
  /** Optional server-rendered snapshot to hydrate polling without a flash. */
  initialSnapshot?: ArenaSnapshot
  /** Pre-fetched activity items — usually the team's own recent sales. */
  initialFeed?: AttackFeedItem[]
  className?: string
}

function emptySnapshot(period: string, team: BattleWidgetProps['team']): ArenaSnapshot {
  return {
    period,
    takenAt: new Date(),
    teams: [
      {
        id: team.id,
        slug: team.slug,
        name: team.name,
        school: '',
        teamColor: team.teamColor,
        teamColorDark: team.teamColorDark,
        goalAmount: team.hpMax,
        salesCount: 0,
        pricePerUnit: 0,
        activePeriod: period,
        raised: 0,
        hpCurrent: team.hpCurrent,
        hpMax: team.hpMax,
        characters: [],
        activeShield: team.activeShield,
      },
    ],
  }
}

export function BattleWidget({
  team,
  period,
  initialSnapshot,
  initialFeed = [],
  className,
}: BattleWidgetProps) {
  const seed = useMemo(
    () => initialSnapshot ?? emptySnapshot(period, team),
    [initialSnapshot, period, team],
  )
  const { snapshot, status, staleness } = useArenaState(seed)

  const live =
    snapshot.teams.find((t) => t.id === team.id) ??
    snapshot.teams.find((t) => t.slug === team.slug) ??
    seed.teams[0]

  const shielded = Boolean(live.activeShield)
  const healthy = status === 'ok' && staleness < 10_000

  return (
    <section
      className={clsx(
        'overflow-hidden rounded-xl border bg-gradient-to-b from-[#0a0603] via-[#140d06] to-[#05070a] text-white shadow-xl',
        className,
      )}
      style={{
        borderColor: shielded ? 'rgba(34, 211, 238, 0.6)' : `${team.teamColor}66`,
        boxShadow: shielded
          ? '0 0 24px rgba(34, 211, 238, 0.35)'
          : `0 0 18px ${team.teamColor}33`,
      }}
      aria-label={`${team.name} battle widget`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-black/40 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
          <Swords className="h-3 w-3" />
          Battle Arena
          <span className="font-mono text-neutral-500">· {period}</span>
        </div>
        <div
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-neutral-400"
          aria-live="polite"
        >
          <span
            className={clsx(
              'h-1.5 w-1.5 rounded-full',
              healthy
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                : status === 'error'
                  ? 'bg-red-500'
                  : 'animate-pulse bg-amber-400',
            )}
          />
          {healthy ? 'Live' : status === 'error' ? 'Retry' : 'Sync'}
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold">{team.name}</h3>
            {shielded && live.activeShield && (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                <Shield className="h-3 w-3" />
                Shield
                <ShieldTimer expiresAt={live.activeShield.expiresAt} />
              </div>
            )}
          </div>
          {shielded && (
            <div
              className="pointer-events-none relative h-10 w-10 shrink-0"
              aria-hidden
            >
              <ShieldVisuals />
            </div>
          )}
        </div>

        <HpBar
          hpCurrent={live.hpCurrent}
          hpMax={live.hpMax}
          teamColor={team.teamColor}
        />

        <ShareButton
          teamId={team.id}
          teamSlug={team.slug}
          teamName={team.name}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            <span>Recent activity</span>
            <span className="font-mono text-neutral-500">
              {initialFeed.length} event{initialFeed.length === 1 ? '' : 's'}
            </span>
          </div>
          <AttackFeed items={initialFeed} />
        </div>
      </div>
    </section>
  )
}
