import Link from 'next/link'
import { ArrowRight, Shield, Swords } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HpBar } from '@/components/arena/hp-bar'
import prisma from '@/lib/prisma'

export interface BattleArenaPanelProps {
  /** Fundraiser slug — the FundraiserTeam row shares this slug when linked. */
  slug: string
  /** Tailwind className for the outer Card wrapper. */
  className?: string
}

/**
 * Public-facing arena panel embedded on the fundraiser page.
 *
 * Renders nothing if the fundraiser has not been linked to a
 * `FundraiserTeam` via the admin "Battle Arena" tab. When present, shows HP,
 * period, active shield state, team colors, and a CTA into the full battle
 * page at `/fundraise/[slug]`.
 */
export async function BattleArenaPanel({ slug, className }: BattleArenaPanelProps) {
  const now = new Date()
  const team = await prisma.fundraiserTeam.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      school: true,
      status: true,
      activePeriod: true,
      teamColor: true,
      teamColorDark: true,
      goalAmount: true,
      salesCount: true,
      hpCurrent: true,
      fundraiser: { select: { defaultUnitPrice: true } },
      shields: {
        where: { expiresAt: { gt: now }, remainingHP: { gt: 0 } },
        orderBy: { expiresAt: 'desc' },
        take: 1,
        select: { id: true, expiresAt: true, remainingHP: true },
      },
    },
  })

  if (!team) return null

  const shield = team.shields[0] ?? null
  const raised = team.salesCount * Number(team.fundraiser.defaultUnitPrice)

  return (
    <Card
      className={`overflow-hidden border-0 text-white shadow-xl ${className ?? ''}`.trim()}
      style={{
        background: `linear-gradient(135deg, ${team.teamColor} 0%, ${team.teamColorDark} 100%)`,
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Swords className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-sm uppercase tracking-widest text-white/80">
                Battle Arena
              </CardTitle>
              <p className="text-xs text-white/70">
                Period <span className="font-mono font-semibold">{team.activePeriod}</span>
              </p>
            </div>
          </div>
          <Badge
            className={
              team.status === 'ACTIVE'
                ? 'bg-white/20 text-white hover:bg-white/25 backdrop-blur-sm'
                : 'bg-black/25 text-white hover:bg-black/30 backdrop-blur-sm'
            }
          >
            {team.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg bg-black/25 p-3 backdrop-blur-sm">
          <HpBar
            hpCurrent={team.hpCurrent}
            hpMax={Math.max(1, team.goalAmount)}
            teamColor="#FFFFFF"
            showLabel
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-white/10 p-2 backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-wider text-white/70">Sales</div>
            <div className="text-lg font-bold">{team.salesCount}</div>
          </div>
          <div className="rounded-md bg-white/10 p-2 backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-wider text-white/70">Raised</div>
            <div className="text-lg font-bold">${raised.toLocaleString()}</div>
          </div>
          <div className="rounded-md bg-white/10 p-2 backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-wider text-white/70">Goal HP</div>
            <div className="text-lg font-bold">{team.goalAmount}</div>
          </div>
        </div>

        {shield && (
          <div className="flex items-center gap-2 rounded-md bg-blue-500/30 p-2 text-xs backdrop-blur-sm">
            <Shield className="h-4 w-4 shrink-0" />
            <span>
              Shield active — <strong>{shield.remainingHP} HP</strong> until{' '}
              {new Date(shield.expiresAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {team.status === 'ACTIVE' ? (
          <Link
            href={`/arena/${team.activePeriod}`}
            className="flex items-center justify-center gap-2 rounded-md bg-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/30 backdrop-blur-sm"
          >
            Enter the Arena <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <div className="rounded-md bg-black/25 px-4 py-2 text-center text-xs text-white/80 backdrop-blur-sm">
            Arena page opens once this team is approved.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
