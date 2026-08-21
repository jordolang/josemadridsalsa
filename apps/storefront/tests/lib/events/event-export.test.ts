import { describe, expect, it } from 'vitest'
import { eventCsvRow, eventsToCsv, type CsvExportableEvent } from '@/lib/events/event-export'
import { SHOW_CSV_HEADER } from '@/lib/events/show-import'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d)

const event = (overrides: Partial<CsvExportableEvent> = {}): CsvExportableEvent => ({
  title: 'Zanesville Festival',
  venue: 'Riverside Park',
  address: '1 Main St',
  city: 'Zanesville',
  state: 'OH',
  driveTime: '0h 15m',
  startDate: at(2026, 8, 29),
  endDate: at(2026, 8, 30),
  eventTimes: 'Sat 10am-6pm',
  applicationDeadline: at(2026, 6, 1),
  applicationDeadlineText: null,
  boothFee: 750,
  boothFeeEstimated: false,
  boothFeeNote: null,
  attendance: 12000,
  attendanceEstimated: true,
  exhibitors: 90,
  exhibitorsEstimated: false,
  costOfFuel: 40,
  lodging: null,
  meals: 60,
  applicationInfo: 'Apply online',
  externalId: 'https://festivalnet.com/12345',
  contacts: [{ name: 'Pat Rivera', email: 'pat@example.com' }],
  ...overrides,
})

describe('eventsToCsv', () => {
  it('emits exactly the Show import header, so the file re-imports', () => {
    const csv = eventsToCsv([event()])
    const header = csv.split('\r\n')[0]
    // toCsv quotes every cell; the importer compares the raw header text.
    expect(header.replace(/"/g, '')).toBe(SHOW_CSV_HEADER)
  })

  it('writes one row per event', () => {
    const csv = eventsToCsv([event(), event({ title: 'County Fair' })])
    expect(csv.split('\r\n')).toHaveLength(3)
  })
})

describe('eventCsvRow', () => {
  it('formats dates as MM/DD/YYYY', () => {
    const row = eventCsvRow(event())
    expect(row[6]).toBe('08/29/2026')
    expect(row[7]).toBe('08/30/2026')
  })

  it('repeats the start date when there is no end date', () => {
    expect(eventCsvRow(event({ endDate: null }))[7]).toBe('08/29/2026')
  })

  it('formats money with a dollar sign and two decimals', () => {
    expect(eventCsvRow(event())[10]).toBe('$750.00')
  })

  it('marks an estimated fee with a trailing asterisk', () => {
    expect(eventCsvRow(event({ boothFeeEstimated: true }))[10]).toBe('$750.00*')
  })

  it('appends a fee note in parentheses', () => {
    expect(
      eventCsvRow(event({ boothFeeEstimated: true, boothFeeNote: 'Contact' }))[10]
    ).toBe('$750.00* (Contact)')
  })

  it('leaves a missing number empty rather than writing zero', () => {
    expect(eventCsvRow(event({ boothFee: null }))[10]).toBe('')
    expect(eventCsvRow(event({ attendance: null }))[11]).toBe('')
    expect(eventCsvRow(event())[14]).toBe('')
  })

  it('marks an estimated attendance with a trailing asterisk', () => {
    expect(eventCsvRow(event())[11]).toBe('12000*')
  })

  it('prefers the verbatim deadline text over the parsed date', () => {
    expect(
      eventCsvRow(event({ applicationDeadlineText: 'until full' }))[9]
    ).toBe('until full')
  })

  it('falls back to the parsed deadline when there is no text', () => {
    expect(eventCsvRow(event())[9]).toBe('06/01/2026')
  })

  it('carries the first contact only', () => {
    const row = eventCsvRow(
      event({
        contacts: [
          { name: 'Pat Rivera', email: 'pat@example.com' },
          { name: 'Sam Lee', email: 'sam@example.com' },
        ],
      })
    )
    expect(row[16]).toBe('Pat Rivera')
    expect(row[17]).toBe('pat@example.com')
  })

  it('leaves the contact cells empty when there are no contacts', () => {
    const row = eventCsvRow(event({ contacts: [] }))
    expect(row[16]).toBe('')
    expect(row[17]).toBe('')
  })
})
