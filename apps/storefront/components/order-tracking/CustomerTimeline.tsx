import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Mail,
  MailOpen,
  MapPin,
  MessageSquare,
  Package,
  PackageCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { CustomerTimelineEntry, CustomerTimelineKind } from '@/lib/order-tracking/timeline'

const ICONS: Record<CustomerTimelineKind, LucideIcon> = {
  received: Package,
  payment: CreditCard,
  status: CheckCircle2,
  note: MessageSquare,
  delay: AlertTriangle,
  email_in: MailOpen,
  email_out: Mail,
  shipped: Truck,
  carrier: MapPin,
  delivered: PackageCheck,
}

// The business runs on Ohio time; say so rather than guessing the viewer's zone on the server.
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
  timeZoneName: 'short',
})

export function formatTrackingTime(date: Date): string {
  return timeFormatter.format(date)
}

/** Everything that has happened to an order, newest first. */
export function CustomerTimeline({ entries }: { entries: CustomerTimelineEntry[] }) {
  return (
    <ol className="space-y-5">
      {entries.map((entry, index) => {
        const Icon = ICONS[entry.kind]
        const highlight = entry.kind === 'delay'
        return (
          <li key={`${entry.kind}-${entry.at.getTime()}-${index}`} className="flex gap-3">
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                highlight ? 'bg-amber-100 text-amber-700' : 'bg-muted text-foreground'
              }`}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p className="font-medium break-words">{entry.title}</p>
                <time
                  dateTime={entry.at.toISOString()}
                  className="shrink-0 text-sm text-muted-foreground"
                >
                  {formatTrackingTime(entry.at)}
                </time>
              </div>
              {entry.location && <p className="text-sm text-muted-foreground">{entry.location}</p>}
              {entry.detail && (
                <p className="mt-1 text-sm break-words text-muted-foreground">{entry.detail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
