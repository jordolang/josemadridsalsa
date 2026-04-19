'use client'

import { UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export type TeamMember = {
  id: string
  name: string
  avatarUrl?: string | null
  amountRaised: number
  supporterCount: number
  href?: string
}

export interface TeamMembersStripProps {
  title?: string
  members: TeamMember[]
  onFundraise?: () => void
  className?: string
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Horizontal strip of team-member avatars (80px, ring-white + shadow),
 * name, amount raised, and supporter count.
 */
export function TeamMembersStrip({
  title = 'Team Members',
  members,
  onFundraise,
  className,
}: TeamMembersStripProps) {
  return (
    <section className={cn('w-full space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        {onFundraise && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFundraise}
            className="rounded-full border-slate-300 bg-white"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Fundraise
          </Button>
        )}
      </div>
      <div className="flex gap-5 overflow-x-auto pb-2">
        {members.map((m) => {
          const inner = (
            <div className="flex w-28 shrink-0 flex-col items-center text-center">
              <Avatar className="h-20 w-20 shadow-md ring-4 ring-white">
                {m.avatarUrl && (
                  <AvatarImage src={m.avatarUrl} alt={m.name} />
                )}
                <AvatarFallback className="bg-indigo-50 text-base font-semibold text-indigo-700">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="mt-3 w-full truncate text-sm font-semibold text-slate-900">
                {m.name}
              </div>
              <div className="text-base font-bold text-slate-900">
                {formatCurrency(m.amountRaised)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.supporterCount} Supporter
                {m.supporterCount === 1 ? '' : 's'}
              </div>
            </div>
          )
          return m.href ? (
            <a
              key={m.id}
              href={m.href}
              className="transition-transform hover:-translate-y-0.5"
            >
              {inner}
            </a>
          ) : (
            <div key={m.id}>{inner}</div>
          )
        })}
      </div>
    </section>
  )
}
