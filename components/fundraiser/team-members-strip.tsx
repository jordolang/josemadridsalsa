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

/**
 * Horizontal strip of team-member avatars with name, amount raised, and
 * supporter count. "Fundraise" CTA appears top-right when `onFundraise`
 * is provided.
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
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {onFundraise && (
          <Button variant="outline" size="sm" onClick={onFundraise}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Fundraise
          </Button>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {members.map((m) => {
          const inner = (
            <div className="flex w-24 shrink-0 flex-col items-center text-center">
              <Avatar className="h-16 w-16 ring-2 ring-border">
                {m.avatarUrl && (
                  <AvatarImage src={m.avatarUrl} alt={m.name} />
                )}
                <AvatarFallback>{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="mt-2 truncate text-sm font-semibold">
                {m.name}
              </div>
              <div className="text-sm font-bold text-foreground">
                ${m.amountRaised.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {m.supporterCount} Supporter
                {m.supporterCount === 1 ? '' : 's'}
              </div>
            </div>
          )
          return m.href ? (
            <a
              key={m.id}
              href={m.href}
              className="transition-opacity hover:opacity-80"
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
