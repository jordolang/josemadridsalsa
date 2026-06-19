export type TrackingEvent = {
  status: string;
  message: string;
  datetime: string;
  location?: string;
};

type Props = {
  events: TrackingEvent[];
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function TrackingTimeline({ events }: Props) {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div
          key={index}
          className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
        >
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
              <p className="font-medium text-sm">{event.message}</p>
              <time className="text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(event.datetime)}
              </time>
            </div>
            {event.location && (
              <p className="text-sm text-muted-foreground mt-1">
                {event.location}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              Status: {event.status.replace(/_/g, ' ').toLowerCase()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
