import { Card } from '@/components/ui/card'
import { getBarWidth } from '@/lib/analytics/chart-utils'

type CountRecord = {
  label: string
  count: number
}

interface TrafficSourcesCardProps {
  trafficSources: CountRecord[]
  topCountries: CountRecord[]
}

export function TrafficSourcesCard({
  trafficSources,
  topCountries,
}: TrafficSourcesCardProps) {
  const maxTraffic = trafficSources.reduce((max, item) => Math.max(max, item.count), 0)
  const maxCountry = topCountries.reduce((max, item) => Math.max(max, item.count), 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Traffic Sources</h2>
            <p className="text-sm text-muted-foreground">Top referrers for sessions</p>
          </div>
        </div>
        {trafficSources.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No traffic data recorded in this range.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {trafficSources.map((source) => (
              <li key={source.label} className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{source.label}</span>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-indigo-500 transition-all"
                      style={{ width: getBarWidth(source.count, maxTraffic) }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {source.count.toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold">Top Countries</h2>
        <p className="text-sm text-muted-foreground">Geo distribution of visitors</p>
        {topCountries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No geo data captured for this range.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {topCountries.map((country) => (
              <li key={country.label} className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{country.label}</span>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{ width: getBarWidth(country.count, maxCountry) }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {country.count.toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
