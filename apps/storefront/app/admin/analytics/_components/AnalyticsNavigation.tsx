import Link from 'next/link'
import { type AnalyticsRangeKey } from '@/lib/analytics/date-range'

interface AnalyticsNavigationProps {
  activeRange: AnalyticsRangeKey
}

export function AnalyticsNavigation({ activeRange }: AnalyticsNavigationProps) {
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
      <Link
        href={`/admin/analytics?range=${activeRange}`}
        className="rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
      >
        Overview
      </Link>
      <Link
        href="/admin/analytics/fundraisers"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
      >
        Fundraisers
      </Link>
      <Link
        href="/admin/analytics/social"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
      >
        Social
      </Link>
      <Link
        href="/admin/analytics/orders"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
      >
        Orders
      </Link>
      <Link
        href="/admin/analytics/inventory"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
      >
        Inventory
      </Link>
      <Link
        href={`/admin/analytics/inventory-turnover?range=${activeRange}`}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
      >
        Turnover
      </Link>
      <Link
        href={`/admin/analytics/margin?range=${activeRange}`}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
      >
        Margin
      </Link>
      <Link
        href={`/admin/analytics/retention?range=${activeRange}`}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background/60"
      >
        Retention
      </Link>
    </nav>
  )
}
