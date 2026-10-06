'use client'

import { MotionConfig } from 'framer-motion'
import type { ArenaSnapshot } from '@/lib/arena/server-state'
import { useArenaState } from '@/lib/arena/use-arena-state'
import { BattleArenaGame } from '@/components/arena/battle-arena-game'
import { LeaderboardTable } from '@/components/arena/leaderboard-table'

/**
 * Client shell for the arena: the Battle Arena game, then the team standings, kept live by
 * polling /state. Framer-motion's AnimatePresence handles team reorder transitions when
 * salesCount changes flip the leaderboard.
 */
export function ArenaClient({ snapshot: initial }: { snapshot: ArenaSnapshot }) {
  const { snapshot } = useArenaState(initial)
  return (
    <MotionConfig reducedMotion="user">
      <section className="space-y-6">
        <BattleArenaGame />
        <LeaderboardTable teams={snapshot.teams} />
      </section>
    </MotionConfig>
  )
}
