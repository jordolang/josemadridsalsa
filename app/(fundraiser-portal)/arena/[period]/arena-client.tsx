'use client'

import { AnimatePresence, MotionConfig } from 'framer-motion'
import type { ArenaSnapshot } from '@/lib/arena/server-state'
import { useArenaState } from '@/lib/arena/use-arena-state'
import { TeamCard } from '@/components/arena/team-card'
import { LeaderboardTable } from '@/components/arena/leaderboard-table'

function LiveBadge({ status, staleness }: { status: string; staleness: number }) {
  const healthy = status === 'ok' && staleness < 10_000
  return (
    <div
      className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-neutral-800 bg-black/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur"
      aria-live="polite"
    >
      <span
        className={
          'h-2 w-2 rounded-full ' +
          (healthy
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
            : status === 'error'
              ? 'bg-red-500'
              : 'bg-amber-400 animate-pulse')
        }
      />
      <span className="text-neutral-400">
        {healthy ? 'LIVE' : status === 'error' ? 'RETRY' : 'SYNC'}
      </span>
    </div>
  )
}

/**
 * Client shell for the arena — subscribes to /state polling and renders the
 * current snapshot. Framer-motion's AnimatePresence handles team reorder
 * transitions when salesCount changes flip the leaderboard.
 */
export function ArenaClient({ snapshot: initial }: { snapshot: ArenaSnapshot }) {
  const { snapshot, status, staleness } = useArenaState(initial)

  return (
    <MotionConfig reducedMotion="user">
      <LiveBadge status={status} staleness={staleness} />
      <AnimatePresence initial>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] justify-items-center gap-4 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:gap-8">
          {snapshot.teams.map((team, rank) => (
            <TeamCard key={team.id} team={team} rank={rank} />
          ))}
        </div>
      </AnimatePresence>
      <LeaderboardTable teams={snapshot.teams} />
    </MotionConfig>
  )
}
