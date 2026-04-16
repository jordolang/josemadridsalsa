'use client'

import { AnimatePresence } from 'framer-motion'
import type { ArenaSnapshot } from '@/lib/arena/server-state'
import { TeamCard } from '@/components/arena/team-card'

/**
 * Client-side shell for the arena. Real-time updates arrive in Phase 4;
 * for now this just animates the static snapshot into view.
 */
export function ArenaClient({ snapshot }: { snapshot: ArenaSnapshot }) {
  return (
    <AnimatePresence initial>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] justify-items-center gap-8">
        {snapshot.teams.map((team, rank) => (
          <TeamCard key={team.id} team={team} rank={rank} />
        ))}
      </div>
    </AnimatePresence>
  )
}
