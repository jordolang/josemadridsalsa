import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { rankQueues, type QueueCounts, type QueueSeverity } from '@/lib/admin/operational-queues'

const SEVERITY_STYLES: Record<QueueSeverity, string> = {
  critical: 'border-destructive/40 bg-destructive/5',
  attention: 'border-amber-500/40 bg-amber-500/5',
  info: 'border-border',
}

const SEVERITY_TEXT: Record<QueueSeverity, string> = {
  critical: 'text-destructive',
  attention: 'text-amber-600 dark:text-amber-500',
  info: 'text-foreground',
}

/**
 * "What needs doing right now."
 *
 * Every tile is a link into the filtered list it counts, so a number is always one click
 * from the rows behind it. Cleared queues stay visible but muted — knowing that nothing is
 * waiting is itself useful, and hiding them would make the layout jump around.
 */
export function OperationalQueues({ counts }: { counts: QueueCounts }) {
  const queues = rankQueues(counts)
  const outstanding = queues.filter((q) => q.count > 0)

  if (outstanding.length === 0) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-500" />
          <div>
            <p className="font-medium">Nothing needs attention</p>
            <p className="text-sm text-muted-foreground">
              No unshipped orders, failed payments, open returns or pending applications.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {queues.map((queue) => {
        const isClear = queue.count === 0
        return (
          <Link key={queue.key} href={queue.href} className="group">
            <Card
              className={cn(
                'h-full transition-colors',
                isClear ? 'border-border opacity-60' : SEVERITY_STYLES[queue.severity],
                'group-hover:border-primary/50'
              )}
            >
              <CardContent className="flex items-start justify-between gap-3 py-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{queue.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{queue.action}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      isClear ? 'text-muted-foreground' : SEVERITY_TEXT[queue.severity]
                    )}
                  >
                    {queue.count}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
