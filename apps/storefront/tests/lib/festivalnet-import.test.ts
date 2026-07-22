import { describe, expect, it } from 'vitest'
import {
  detectColumnMapping,
  fallbackKey,
  parseFestivalNetCsv,
  parseLooseDate,
  parseMoney,
} from '@/lib/events/festivalnet-import'

describe('detectColumnMapping', () => {
  it('maps typical FestivalNet headers', () => {
    const mapping = detectColumnMapping([
      'Event Name',
      'City',
      'Start Date',
      'End Date',
      'Application Deadline',
      'Booth Fee',
    ])
    expect(mapping.title).toBe('Event Name')
    expect(mapping.location).toBe('City')
    expect(mapping.startDate).toBe('Start Date')
    expect(mapping.endDate).toBe('End Date')
    expect(mapping.applicationDeadline).toBe('Application Deadline')
    expect(mapping.boothFee).toBe('Booth Fee')
  })

  it('is case- and punctuation-insensitive', () => {
    const mapping = detectColumnMapping(['EVENT_NAME', 'start-date'])
    expect(mapping.title).toBe('EVENT_NAME')
    expect(mapping.startDate).toBe('start-date')
  })

  it('never assigns one column to two fields', () => {
    const mapping = detectColumnMapping(['Date', 'Deadline'])
    const used = Object.values(mapping)
    expect(new Set(used).size).toBe(used.length)
  })

  it('prefers an exact deadline column over a loose date match', () => {
    const mapping = detectColumnMapping(['Start Date', 'Deadline'])
    expect(mapping.applicationDeadline).toBe('Deadline')
    expect(mapping.startDate).toBe('Start Date')
  })

  it('leaves unknown headers unmapped', () => {
    const mapping = detectColumnMapping(['Sasquatch Index'])
    expect(mapping.title).toBeUndefined()
  })
})

describe('parseLooseDate', () => {
  const cases: Array<[string, string]> = [
    ['2026-08-14', '2026-08-14'],
    ['08/14/2026', '2026-08-14'],
    ['8/14/2026', '2026-08-14'],
    ['August 14, 2026', '2026-08-14'],
    ['Aug 14, 2026', '2026-08-14'],
    ['2026/08/14', '2026-08-14'],
    ['08-14-2026', '2026-08-14'],
  ]

  it.each(cases)('parses %s', (input, expected) => {
    const d = parseLooseDate(input)
    expect(d).not.toBeNull()
    const iso = `${d!.getFullYear()}-${String(d!.getMonth() + 1).padStart(2, '0')}-${String(
      d!.getDate()
    ).padStart(2, '0')}`
    expect(iso).toBe(expected)
  })

  it('anchors at noon so a timezone shift cannot roll the date back', () => {
    expect(parseLooseDate('2026-08-14')!.getHours()).toBe(12)
  })

  it('returns null for empty or unparseable input', () => {
    expect(parseLooseDate('')).toBeNull()
    expect(parseLooseDate(null)).toBeNull()
    expect(parseLooseDate(undefined)).toBeNull()
    expect(parseLooseDate('sometime next fall')).toBeNull()
  })
})

describe('parseMoney', () => {
  it('strips currency formatting', () => {
    expect(parseMoney('$1,250.00')).toBe(1250)
    expect(parseMoney('275')).toBe(275)
    expect(parseMoney(' $75.50 ')).toBe(75.5)
  })

  it('returns null when there is no number', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney(null)).toBeNull()
    expect(parseMoney('TBD')).toBeNull()
  })

  it('rejects negative fees', () => {
    expect(parseMoney('-50')).toBeNull()
  })
})

describe('fallbackKey', () => {
  it('ignores case and punctuation in the title', () => {
    const a = fallbackKey('Zanesville Art & Wine Fest', new Date(2026, 7, 14, 12))
    const b = fallbackKey('zanesville art wine fest', new Date(2026, 7, 14, 12))
    expect(a).toBe(b)
  })

  it('ignores the time of day', () => {
    expect(fallbackKey('X', new Date(2026, 7, 14, 8))).toBe(
      fallbackKey('X', new Date(2026, 7, 14, 20))
    )
  })

  it('separates the same show in different years', () => {
    expect(fallbackKey('X', new Date(2026, 7, 14, 12))).not.toBe(
      fallbackKey('X', new Date(2027, 7, 14, 12))
    )
  })
})

describe('parseFestivalNetCsv', () => {
  const csv = [
    'Event Name,City,Start Date,End Date,Application Deadline,Booth Fee',
    'Zanesville Art Fest,"Zanesville, OH",08/14/2026,08/16/2026,05/01/2026,"$275.00"',
    'Dublin Irish Fest,"Dublin, OH",08/21/2026,08/23/2026,04/15/2026,$350',
  ].join('\n')

  it('parses rows with detected headers', () => {
    const parsed = parseFestivalNetCsv(csv)
    expect(parsed.missingRequired).toEqual([])
    expect(parsed.rows).toHaveLength(2)

    const first = parsed.rows[0]
    expect(first.title).toBe('Zanesville Art Fest')
    expect(first.location).toBe('Zanesville, OH')
    expect(first.boothFee).toBe(275)
    expect(first.error).toBeNull()
    expect(first.startDate!.getMonth()).toBe(7)
    expect(first.applicationDeadline!.getMonth()).toBe(4)
  })

  it('numbers rows from 1 for error reporting', () => {
    expect(parseFestivalNetCsv(csv).rows.map((r) => r.rowNumber)).toEqual([1, 2])
  })

  it('flags a row missing the event name', () => {
    const bad = ['Event Name,Start Date', ',08/14/2026'].join('\n')
    expect(parseFestivalNetCsv(bad).rows[0].error).toBe('Missing event name')
  })

  it('flags an unparseable start date instead of dropping the row', () => {
    const bad = ['Event Name,Start Date', 'Some Fest,whenever'].join('\n')
    const row = parseFestivalNetCsv(bad).rows[0]
    expect(row.error).toContain('Unrecognized start date')
    expect(row.title).toBe('Some Fest')
  })

  it('reports required fields with no column', () => {
    const parsed = parseFestivalNetCsv('Sasquatch Index\n42')
    expect(parsed.missingRequired).toContain('title')
    expect(parsed.missingRequired).toContain('startDate')
  })

  it('drops an end date that precedes the start', () => {
    const bad = ['Event Name,Start Date,End Date', 'Some Fest,08/14/2026,08/01/2026'].join('\n')
    expect(parseFestivalNetCsv(bad).rows[0].endDate).toBeNull()
  })

  it('honours an explicit mapping override', () => {
    const weird = ['Thing,When', 'Fall Fest,09/12/2026'].join('\n')
    const parsed = parseFestivalNetCsv(weird, { title: 'Thing', startDate: 'When' })
    expect(parsed.missingRequired).toEqual([])
    expect(parsed.rows[0].title).toBe('Fall Fest')
  })

  it('skips blank trailing lines', () => {
    expect(parseFestivalNetCsv(csv + '\n\n').rows).toHaveLength(2)
  })
})
