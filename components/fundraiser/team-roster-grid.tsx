import { Trophy, Sword, Wand2, Crosshair, Footprints, Shield, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { TeamMember } from './team-members-strip'

interface TeamRosterGridProps {
  members: TeamMember[]
  /**
   * Optional per-member class + quip overlay. Keyed by member id so @tom's
   * character rows can map cleanly when T7 lands.
   */
  metaById?: Record<string, { characterClass?: string; quip?: string }>
  className?: string
}

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

export function TeamRosterGrid({ members, metaById, className }: TeamRosterGridProps) {
  if (members.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
        No team members yet.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {members.map((m) => {
        const meta = metaById?.[m.id]
        const Icon = iconFor(meta?.characterClass)
        const card = (
          <div className="flex h-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
            <div className="relative mb-3">
              <Avatar className="h-20 w-20 shadow-md ring-4 ring-white">
                {m.avatarUrl && (
                  <AvatarImage src={m.avatarUrl} alt={m.name} />
                )}
                <AvatarFallback className="bg-indigo-50 text-base font-semibold text-indigo-700">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              {meta?.characterClass && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow"
                  aria-label={meta.characterClass}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            <div className="w-full truncate text-sm font-semibold text-slate-900">
              {m.name}
            </div>
            {meta?.quip && (
              <div className="mt-1 line-clamp-2 text-[11px] italic text-muted-foreground">
                &ldquo;{meta.quip}&rdquo;
              </div>
            )}
            <div className="mt-3 text-base font-bold text-slate-900">
              {formatCurrency(m.amountRaised)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {m.supporterCount} Supporter{m.supporterCount === 1 ? '' : 's'}
            </div>
          </div>
        )
        return m.href ? (
          <a key={m.id} href={m.href} className="block h-full">
            {card}
          </a>
        ) : (
          <div key={m.id}>{card}</div>
        )
      })}
    </div>
  )
}
