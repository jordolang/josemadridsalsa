import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  LineChart,
  Timer,
  TrendingDown,
  UserPlus,
  Users,
} from 'lucide-react'

import { StatsCard } from '@/components/admin/StatsCard'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { GoogleAnalyticsSummaryCard } from '@/types/analytics'

const GA_SUMMARY_ICON_MAP: Record<string, LucideIcon> = {
  sessions: BarChart3,
  totalUsers: Users,
  newUsers: UserPlus,
  engagedSessions: LineChart,
  bounceRate: TrendingDown,
  averageSessionDuration: Timer,
}

interface GoogleAnalyticsSummaryProps {
  summaryCards: GoogleAnalyticsSummaryCard[]
  isReady: boolean
  message?: string
}

export function GoogleAnalyticsSummary({
  summaryCards,
  isReady,
  message,
}: GoogleAnalyticsSummaryProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Google Analytics overview</h2>
          <p className="text-sm text-muted-foreground">
            Live GA4 metrics for the selected range
          </p>
        </div>
        <Badge
          className={
            isReady
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-muted text-foreground'
          }
        >
          {isReady ? 'Live data' : 'Awaiting configuration'}
        </Badge>
      </div>
      {summaryCards.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {message ?? 'No Google Analytics metrics are available for this range yet.'}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = GA_SUMMARY_ICON_MAP[card.metric] ?? BarChart3
            return (
              <StatsCard
                key={card.metric}
                title={card.label}
                value={card.formattedValue}
                icon={Icon}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
