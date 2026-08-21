/**
 * CSV export for shows.
 *
 * Emits exactly the 20-column Show import header so a file can go back in
 * through `/admin/events/import` unchanged. Two consequences of matching that
 * shape, both deliberate:
 *
 *  - Booking status and the "Where is Jose?" flag are not columns in it, so
 *    they do not survive a round trip. Appending them would break the header
 *    match `isShowCsv` does and send the file down the loose FestivalNet
 *    mapping path instead, which is worse.
 *  - Rows with no FestivalNet posting URL — anything entered by hand or pulled
 *    from Google Calendar — re-import as new records rather than matching, and
 *    will be rejected outright if other required cells are empty. The importer
 *    keys on that URL; there is no other natural key.
 */

import { format } from 'date-fns'
import { toCsv } from '@/lib/csv'
import { SHOW_CSV_COLUMNS } from './show-import'

export interface CsvExportableEvent {
  title: string
  venue: string | null
  address: string | null
  city: string | null
  state: string | null
  driveTime: string | null
  startDate: Date
  endDate: Date | null
  eventTimes: string | null
  applicationDeadline: Date | null
  applicationDeadlineText: string | null
  boothFee: number | null
  boothFeeEstimated: boolean
  boothFeeNote: string | null
  attendance: number | null
  attendanceEstimated: boolean
  exhibitors: number | null
  exhibitorsEstimated: boolean
  costOfFuel: number | null
  lodging: number | null
  meals: number | null
  applicationInfo: string | null
  externalId: string | null
  contacts: Array<{ name: string; email: string | null }>
}

const asDate = (value: Date | null) => (value ? format(value, 'MM/dd/yyyy') : '')

/** `$750.00`, `$750.00*` when estimated, `$750.00* (Contact)` with a note. */
function money(
  value: number | null,
  estimated = false,
  note: string | null = null
): string {
  if (value === null) return ''
  const base = `$${value.toFixed(2)}${estimated ? '*' : ''}`
  return note ? `${base} (${note})` : base
}

function count(value: number | null, estimated = false): string {
  if (value === null) return ''
  return `${value}${estimated ? '*' : ''}`
}

export function eventCsvRow(event: CsvExportableEvent): Array<string> {
  // The export carries one contact; the importer only ever reads one.
  const contact = event.contacts[0]

  return [
    event.title,
    event.venue ?? '',
    event.address ?? '',
    event.city ?? '',
    event.state ?? '',
    event.driveTime ?? '',
    asDate(event.startDate),
    asDate(event.endDate ?? event.startDate),
    event.eventTimes ?? '',
    // The verbatim cell wins: it preserves prose deadlines ("until full") that
    // never parsed into a date in the first place.
    event.applicationDeadlineText ?? asDate(event.applicationDeadline),
    money(event.boothFee, event.boothFeeEstimated, event.boothFeeNote),
    count(event.attendance, event.attendanceEstimated),
    count(event.exhibitors, event.exhibitorsEstimated),
    money(event.costOfFuel),
    money(event.lodging),
    money(event.meals),
    contact?.name ?? '',
    contact?.email ?? '',
    event.applicationInfo ?? '',
    event.externalId ?? '',
  ]
}

export function eventsToCsv(events: CsvExportableEvent[]): string {
  return toCsv([...SHOW_CSV_COLUMNS], events.map(eventCsvRow))
}
