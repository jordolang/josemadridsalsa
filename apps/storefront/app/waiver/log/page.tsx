import type { Metadata } from 'next'
import { Download } from 'lucide-react'
import { AutoRefresh } from '@/components/waiver/AutoRefresh'
import { WaiverLogTable } from '@/components/waiver/WaiverLogTable'
import { requireAdminSession } from '@/lib/admin-auth'
import { easternDateKey } from '@/lib/waivers/promoRelease'
import { listPromoReleaseEntries, parseDateKey } from '@/lib/waivers/promoReleaseLog'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Waiver Log',
  description: 'Time- and location-stamped photo release log for matching against event footage.',
  robots: { index: false, follow: false },
}

const REFRESH_SECONDS = 20

/**
 * Staff view of every release signed on a day, to the second, for lining up
 * against camera footage. Refreshes itself while an event is running.
 */
export default async function WaiverLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[]; event?: string | string[] }>
}) {
  await requireAdminSession()
  const params = await searchParams
  const today = easternDateKey(new Date().toISOString())
  const dateKey = parseDateKey(params.date, today)
  const eventFilter = (Array.isArray(params.event) ? params.event[0] : params.event)?.trim() || undefined

  const token = process.env.BLOB_READ_WRITE_TOKEN
  const allEntries = token ? await listPromoReleaseEntries(dateKey, token) : []
  const events = [...new Set(allEntries.map((entry) => entry.event).filter((e): e is string => Boolean(e)))].sort()
  const entries = eventFilter ? allEntries.filter((entry) => entry.event === eventFilter) : allEntries

  const csvParams = new URLSearchParams({ date: dateKey })
  if (eventFilter) csvParams.set('event', eventFilter)

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6 sm:px-8">
      {dateKey === today ? <AutoRefresh seconds={REFRESH_SECONDS} /> : null}
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-salsa-700">Jose Madrid Salsa</p>
            <h1 className="font-serif text-4xl text-stone-900">Waiver log</h1>
            <p className="mt-1 text-stone-600">
              Eastern time, to the second.{' '}
              {dateKey === today ? `Updates every ${REFRESH_SECONDS} seconds.` : null}
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="flex flex-col gap-1 text-sm font-semibold text-stone-700">
              Day
              <input
                type="date"
                name="date"
                defaultValue={dateKey}
                className="h-11 rounded-lg border border-stone-300 bg-white px-3 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-stone-700">
              Event
              <select
                name="event"
                defaultValue={eventFilter ?? ''}
                className="h-11 min-w-44 rounded-lg border border-stone-300 bg-white px-3 text-base"
              >
                <option value="">All events</option>
                {events.map((event) => (
                  <option key={event} value={event}>
                    {event}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-11 rounded-lg bg-stone-800 px-4 font-semibold text-white">
              Show
            </button>
            <a
              href={`/api/waivers/promotional-release/log?${csvParams.toString()}`}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-salsa-700 px-4 font-semibold text-white"
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </a>
          </form>
        </header>

        {!token ? (
          <p className="mt-8 rounded-xl bg-salsa-50 p-4 text-salsa-800">
            Waiver storage is not configured (BLOB_READ_WRITE_TOKEN missing).
          </p>
        ) : (
          <WaiverLogTable
            entries={entries}
            emptyMessage={`No waivers on ${dateKey}${eventFilter ? ` for ${eventFilter}` : ''}.`}
          />
        )}
      </div>
    </main>
  )
}
