import { cn } from '@/lib/utils'

interface CampaignStatsProps {
  raised: number
  goal: number
  supporterCount: number
  teamColor?: string
  currency?: string
  className?: string
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function CampaignStats({
  raised,
  goal,
  supporterCount,
  teamColor,
  currency = 'USD',
  className,
}: CampaignStatsProps) {
  const safeGoal = Math.max(0, goal)
  const pct =
    safeGoal > 0 ? Math.max(0, Math.min(100, (raised / safeGoal) * 100)) : 0

  return (
    <section
      className={cn(
        'rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8',
        className,
      )}
      aria-label="Fundraising progress"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Raised
          </div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {formatCurrency(raised, currency)}
          </div>
        </div>
        <div className="sm:col-span-1 sm:text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Supporters
          </div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {supporterCount.toLocaleString()}
          </div>
        </div>
        <div className="sm:col-span-1 sm:text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            of {formatCurrency(safeGoal, currency)} goal
          </div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {Math.round(pct)}%
          </div>
        </div>
      </div>

      <div
        className="relative mt-6 h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${Math.round(pct)}% of goal raised`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: teamColor ?? undefined,
            backgroundImage: teamColor
              ? undefined
              : 'linear-gradient(to right, rgb(99, 102, 241), rgb(168, 85, 247))',
          }}
        />
      </div>
    </section>
  )
}
