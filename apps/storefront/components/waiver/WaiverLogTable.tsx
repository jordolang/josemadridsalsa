import { ExternalLink, FileText, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatPromoReleaseClock,
  formatPromoReleaseLocation,
  promoReleaseMapUrl,
  type PromoReleaseLogEntry,
} from '@/lib/waivers/promoRelease'

/** Counts plus one row per waiver, to the second, for matching against footage. */
export function WaiverLogTable({ entries, emptyMessage }: { entries: PromoReleaseLogEntry[]; emptyMessage: string }) {
  const agreed = entries.filter((entry) => entry.decision === 'agree').length

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-white px-4 py-1.5 font-semibold text-stone-700 ring-1 ring-stone-200">
          {entries.length} total
        </span>
        <span className="rounded-full bg-verde-50 px-4 py-1.5 font-semibold text-verde-800 ring-1 ring-verde-200">
          {agreed} agreed
        </span>
        <span className="rounded-full bg-salsa-50 px-4 py-1.5 font-semibold text-salsa-800 ring-1 ring-salsa-200">
          {entries.length - agreed} declined
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-100 text-xs uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entries.map((entry) => {
                const mapUrl = promoReleaseMapUrl(entry)
                const yes = entry.decision === 'agree'
                return (
                  <tr key={entry.id} className={cn(!yes && 'bg-salsa-50/40')}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-stone-900">
                      {formatPromoReleaseClock(entry.submittedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold">{entry.code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold',
                          yes ? 'bg-verde-100 text-verde-800' : 'bg-salsa-100 text-salsa-800',
                        )}
                      >
                        {yes ? 'USE' : 'DO NOT USE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {entry.fullName ?? <span className="text-stone-400">Anonymous</span>}
                      {entry.email ? <div className="text-xs text-stone-500">{entry.email}</div> : null}
                      {entry.signingForMinor ? (
                        <div className="text-xs text-stone-500">
                          For a minor{entry.minorName ? `: ${entry.minorName}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{entry.event ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {mapUrl ? (
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {formatPromoReleaseLocation(entry)}
                        </a>
                      ) : (
                        formatPromoReleaseLocation(entry)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.pdfUrl ? (
                        <a
                          href={entry.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-salsa-700"
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          Open
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
