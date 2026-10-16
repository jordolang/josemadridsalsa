'use client'

import { cn } from '@/lib/utils'
import { useBattleLive } from '@/hooks/use-battle-live'
import { BATTLE_ARENA_URL } from '@/lib/arena-game/links'

/** Green blinking circle while anyone is playing; a dim dot otherwise. */
function BattleDot({ live }: { live: boolean }) {
  if (!live) {
    return <span aria-hidden data-testid="battle-dot" className="h-2 w-2 rounded-full bg-current opacity-40" />
  }
  return (
    <span aria-hidden data-testid="battle-dot-live" className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
    </span>
  )
}

function playingLabel(playing: number): string {
  if (playing <= 0) return 'Play the José Madrid Salsa Battle Arena'
  return `${playing} ${playing === 1 ? 'player is' : 'players are'} in the Battle Arena now. Join the fight`
}

/** "Battle Live" entry in the Community dropdown, styled like its other links. Opens the game in a new tab. */
export function BattleLivePanelLink() {
  const { playing } = useBattleLive()
  const live = playing > 0

  return (
    <a
      href={BATTLE_ARENA_URL}
      target="_blank"
      rel="noopener"
      role="menuitem"
      aria-label={playingLabel(playing)}
      className="group rounded-lg px-5 py-4 transition-colors hover:bg-muted/70"
    >
      <div
        className={cn(
          'flex items-center gap-2 font-serif text-[18px] font-bold leading-tight transition-colors',
          live ? 'text-green-600 group-hover:text-green-500' : 'text-foreground group-hover:text-salsa-600',
        )}
      >
        <BattleDot live={live} />
        Battle Live
      </div>
      <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
        {live ? `${playing} playing now. Join the fight` : 'Play the Battle Arena with your team'}
      </div>
    </a>
  )
}

/** Mobile-sheet variant of the Battle Live link. */
export function BattleLiveNavMobileLink({ onNavigate }: { onNavigate?: () => void }) {
  const { playing } = useBattleLive()
  const live = playing > 0

  return (
    <a
      href={BATTLE_ARENA_URL}
      target="_blank"
      rel="noopener"
      onClick={onNavigate}
      className={cn(
        'flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-sm',
        live ? 'bg-green-50 font-semibold text-green-700 hover:bg-green-100' : 'text-foreground hover:bg-accent',
      )}
    >
      <BattleDot live={live} />
      Battle Live
      {live && <span className="ml-auto text-xs font-medium">{playing} playing</span>}
    </a>
  )
}

/** "3 playing now" pill for the homepage Battle Arena section; quiet when nobody is on. */
export function BattleLiveBadge() {
  const { playing } = useBattleLive()
  const live = playing > 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest',
        live ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-white/15 bg-white/5 text-white/70',
      )}
    >
      <BattleDot live={live} />
      {live ? `${playing} playing now` : 'Open 24/7'}
    </span>
  )
}
