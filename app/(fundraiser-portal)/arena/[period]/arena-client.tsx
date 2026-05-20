'use client'

import { MotionConfig } from 'framer-motion'
import type { ArenaSnapshot } from '@/lib/arena/server-state'
import { PlayableArena } from '@/components/arena/playable-arena'

/**
 * Client shell for the arena — subscribes to /state polling and renders the
 * current snapshot. Framer-motion's AnimatePresence handles team reorder
 * transitions when salesCount changes flip the leaderboard.
 */
export function ArenaClient({ snapshot: initial }: { snapshot: ArenaSnapshot }) {
  return (
    <MotionConfig reducedMotion="user">
      <PlayableArena snapshot={initial} />
    </MotionConfig>
  )
}
