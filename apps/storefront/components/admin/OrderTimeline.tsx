import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TimelineEntry } from '@/lib/orders/order-timeline'

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/**
 * Chronological history of an order.
 *
 * Entries marked `reconstructed` were derived from timestamps on the order rather than
 * observed at the time — every order placed before the domain event log shipped falls into
 * that category, and the distinction is surfaced so a derived fact is never mistaken for a
 * recorded one.
 */
export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  const hasReconstructed = entries.some((e) => e.source === 'reconstructed')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-6">
            {entries.map((entry, index) => (
              <li key={`${entry.type}-${entry.at.toISOString()}-${index}`} className="relative">
                <span
                  aria-hidden
                  className={`absolute -left-[1.6875rem] top-1.5 size-2.5 rounded-full ring-4 ring-background ${
                    entry.source === 'recorded' ? 'bg-primary' : 'bg-muted-foreground/40'
                  }`}
                />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{entry.label}</span>
                  {entry.source === 'reconstructed' && (
                    <span
                      className="text-[0.65rem] uppercase tracking-wide text-muted-foreground"
                      title="Derived from stored timestamps, not recorded at the time"
                    >
                      reconstructed
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {timeFormatter.format(entry.at)}
                  {entry.detail ? ` · ${entry.detail}` : ''}
                </div>
              </li>
            ))}
          </ol>
        )}

        {hasReconstructed && (
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Entries marked <span className="uppercase">reconstructed</span> were derived from
            timestamps stored on the order. Events have only been recorded as they happen since
            the activity log was introduced.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
