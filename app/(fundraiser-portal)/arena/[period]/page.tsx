import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { loadArenaSnapshot } from '@/lib/arena/server-state'
import { ArenaClient } from './arena-client'

interface Props {
  params: Promise<{ period: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { period } = await params
  return {
    title: `Fundraiser Arena — ${period}`,
    description: `Live view of every team battling during the ${period} fundraiser period.`,
  }
}

/**
 * Read-only arena page. URL format: /arena/YYYY-MM (matches FundraiserTeam.activePeriod).
 * Phase 4 adds real-time updates; Phase 3 adds server-authoritative HP and combat visuals.
 */
export default async function ArenaPage({ params }: Props) {
  const { period } = await params
  if (!/^\d{4}-\d{2}$/.test(period)) notFound()

  const snapshot = await loadArenaSnapshot(period)

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0603] via-[#1a1208] to-[#05070a] px-6 py-10 text-white">
      <header className="mx-auto mb-10 max-w-5xl text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-500/80">
          Fundraiser Battle Arena — Preview
        </p>
        <h1 className="mt-2 font-mono text-3xl font-bold uppercase tracking-[0.2em] text-amber-300">
          {period}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
          {snapshot.teams.length} team{snapshot.teams.length === 1 ? '' : 's'}
          {' '}active this period. Each sale powers the team that earned it;
          each confirmed share activates a shield.
        </p>
      </header>

      {snapshot.teams.length === 0 ? (
        <div className="mx-auto max-w-md rounded border border-neutral-800 bg-black/40 p-8 text-center font-mono text-xs uppercase tracking-widest text-neutral-500">
          No active teams for {period}.
        </div>
      ) : (
        <section className="mx-auto max-w-6xl">
          <ArenaClient snapshot={snapshot} />
        </section>
      )}
    </main>
  )
}
