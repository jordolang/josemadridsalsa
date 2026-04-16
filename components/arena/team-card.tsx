'use client'

import { motion } from 'framer-motion'
import {
  Shield,
  Sword,
  Wand2,
  Crosshair,
  Footprints,
  Flame,
  Trophy,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { ArenaTeam } from '@/lib/arena/server-state'
import { ShieldVisuals } from './shield-visuals'
import { ShieldTimer } from './shield-timer'

const CLASS_ICON: Record<string, typeof Sword> = {
  warrior: Sword,
  mage: Wand2,
  rogue: Footprints,
  archer: Crosshair,
  paladin: Shield,
  berserker: Flame,
}

function iconFor(characterClass: string | undefined) {
  if (!characterClass) return Trophy
  return CLASS_ICON[characterClass.toLowerCase()] ?? Trophy
}

/**
 * A single team as rendered in the arena grid: animated sprite medallion,
 * shield badge when active, team name, school, and a raised/goal bar.
 *
 * Read-only in this phase — no HP bar yet. Phase 3 adds the combat HP view
 * once the server-authoritative hpCurrent field lands.
 */
export function TeamCard({
  team,
  rank,
}: {
  team: ArenaTeam
  rank: number
}) {
  const Icon = iconFor(team.characters[0]?.characterClass)
  const shielded = Boolean(team.activeShield)
  const raisedPct = Math.min(
    100,
    team.goalAmount > 0 ? Math.round((team.raised / team.goalAmount) * 100) : 0,
  )

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="relative flex w-[240px] flex-col items-center"
    >
      <div className="relative">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={clsx(
            'relative flex h-[120px] w-[120px] items-center justify-center rounded-full border-4 bg-[#111] text-5xl shadow-2xl',
          )}
          style={{
            borderColor: shielded ? '#22d3ee' : team.teamColor,
            boxShadow: shielded
              ? '0 0 25px 4px #22d3ee'
              : `0 0 20px ${team.teamColor}44`,
          }}
        >
          {shielded && <ShieldVisuals />}
          <Icon className="h-16 w-16 text-white" />
        </motion.div>

        {shielded && team.activeShield && (
          <motion.div
            key={team.activeShield.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-1/2 top-[-18px] flex -translate-x-1/2 items-center whitespace-nowrap rounded bg-cyan-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black"
          >
            <Shield className="mr-1 h-3 w-3" />
            Shield
            <ShieldTimer expiresAt={team.activeShield.expiresAt} />
          </motion.div>
        )}
      </div>

      <div
        className="relative mt-4 w-full overflow-hidden rounded-lg border bg-black/70 p-3"
        style={{ borderColor: `${team.teamColor}66` }}
      >
        <div
          className="absolute left-0 top-0 h-1 w-full opacity-50"
          style={{ backgroundColor: team.teamColor }}
        />
        <div className="relative z-10 mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <span
            className="max-w-[150px] truncate rounded px-1.5 py-0.5"
            style={{ backgroundColor: `${team.teamColor}33` }}
            title={team.name}
          >
            {team.name}
          </span>
          <span className="text-amber-400">#{rank + 1}</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full border border-neutral-700 bg-neutral-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${raisedPct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="relative h-full"
            style={{
              backgroundColor: team.teamColor,
              boxShadow: `0 0 15px ${team.teamColor}aa`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/20" />
          </motion.div>
        </div>
        <div className="mt-1 text-right font-mono text-[10px] text-slate-400">
          ${team.raised.toLocaleString()} / ${team.goalAmount.toLocaleString()}
        </div>
        <div
          className="mt-1 truncate font-mono text-[10px] uppercase tracking-widest"
          style={{ color: team.teamColorDark }}
          title={team.school}
        >
          {team.school}
        </div>
      </div>
    </motion.article>
  )
}
