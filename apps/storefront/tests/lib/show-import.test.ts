import { describe, expect, it } from 'vitest'
import {
  SHOW_CSV_COLUMNS,
  SHOW_CSV_HEADER,
  ShowImportError,
  isShowCsv,
  parseShowCsv,
} from '@/lib/events/show-import'

const HEADER = SHOW_CSV_HEADER

/** The verbatim example row from the format spec. */
const CECIL =
  'Cecil County Fair,Fair Hill Fairgrounds,"4640 Telegraph Road, Elkton, MD 21921",Elkton,MD,7h 04m,07/24/2026,08/01/2026,,until full,$350.00,80000,43,$135.35,$990.00,$350.00,Fair Office,vendorinfo@cecilcountyfair.org,View instructions at our web site,https://festivalnet.com/33885/Elkton-Maryland/State-Fairs/Cecil-County-Fair'

const file = (...rows: string[]) => [HEADER, ...rows].join('\r\n') + '\r\n'

/** Rebuilds a row with one column replaced, for targeted failure cases. */
function withField(row: string, index: number, value: string): string {
  const fields = parseFields(row)
  fields[index] = value
  return fields
    .map((f) => (/[",\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f))
    .join(',')
}

function parseFields(row: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < row.length; i++) {
    const c = row[i]
    if (quoted) {
      if (c === '"' && row[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      out.push(field)
      field = ''
    } else {
      field += c
    }
  }
  out.push(field)
  return out
}

describe('SHOW_CSV_HEADER', () => {
  it('matches the header line in the format spec verbatim', () => {
    expect(HEADER).toBe(
      'Event Name,Venue,Address,City,ST,Drive-Time,Start Date,End Date,Times,Application Deadline,Booth Fee,Attendance,# of Exhibitors,Cost of Fuel,Lodging,Meals,Contact Name,Contact Email Address,Application Information,URL of Festivalnet posting'
    )
    expect(SHOW_CSV_COLUMNS).toHaveLength(20)
  })
})

describe('isShowCsv', () => {
  it('recognizes the format through a UTF-8 BOM', () => {
    expect(isShowCsv('﻿' + file(CECIL))).toBe(true)
  })

  it('accepts LF-only line endings', () => {
    expect(isShowCsv([HEADER, CECIL].join('\n'))).toBe(true)
  })

  it('rejects a loose FestivalNet export', () => {
    expect(isShowCsv('Event Name,City,Start Date\nFoo,Elkton,07/24/2026')).toBe(false)
  })
})

describe('parseShowCsv', () => {
  it('parses the spec example row', () => {
    const [row] = parseShowCsv(file(CECIL))

    expect(row.eventName).toBe('Cecil County Fair')
    expect(row.venue).toBe('Fair Hill Fairgrounds')
    // Quoted field: the inner commas belong to the address, not the CSV.
    expect(row.address).toBe('4640 Telegraph Road, Elkton, MD 21921')
    expect(row.city).toBe('Elkton')
    expect(row.state).toBe('MD')
    expect(row.driveTime).toBe('7h 04m')
    expect(row.startDate.getMonth()).toBe(6)
    expect(row.startDate.getDate()).toBe(24)
    expect(row.endDate.getMonth()).toBe(7)
    expect(row.boothFee).toBe(350)
    expect(row.attendance).toBe(80000)
    expect(row.exhibitors).toBe(43)
    expect(row.costOfFuel).toBe(135.35)
    expect(row.lodging).toBe(990)
    expect(row.meals).toBe(350)
    expect(row.contactName).toBe('Fair Office')
    expect(row.contactEmail).toBe('vendorinfo@cecilcountyfair.org')
    expect(row.applicationInfo).toBe('View instructions at our web site')
    expect(row.url).toBe(
      'https://festivalnet.com/33885/Elkton-Maryland/State-Fairs/Cecil-County-Fair'
    )
  })

  it('strips the BOM before reading the first header name', () => {
    expect(() => parseShowCsv('﻿' + file(CECIL))).not.toThrow()
  })

  it('does not treat "# of Exhibitors" as a comment', () => {
    const rows = parseShowCsv(file(CECIL))
    expect(rows).toHaveLength(1)
    expect(rows[0].exhibitors).toBe(43)
  })

  it('reads an empty optional cell as not published, never zero', () => {
    const row = parseShowCsv(file(CECIL))[0]
    expect(row.times).toBeNull()
    expect(withField(CECIL, 8, '')).toContain(',,')
  })

  it('keeps a $0.00 Lodging as a genuine zero', () => {
    const row = parseShowCsv(file(withField(CECIL, 14, '$0.00')))[0]
    expect(row.lodging).toBe(0)
  })

  it('parses dates at noon so a timezone shift cannot roll the day back', () => {
    const row = parseShowCsv(file(CECIL))[0]
    expect(row.startDate.getHours()).toBe(12)
  })

  describe('estimated flags', () => {
    it('strips a trailing * and keeps it as a flag', () => {
      const row = parseShowCsv(
        file(
          withField(
            withField(withField(CECIL, 10, '$750.00*'), 11, '1500*'),
            12,
            '40*'
          )
        )
      )[0]

      expect(row.boothFee).toBe(750)
      expect(row.boothFeeEstimated).toBe(true)
      expect(row.attendance).toBe(1500)
      expect(row.attendanceEstimated).toBe(true)
      expect(row.exhibitors).toBe(40)
      expect(row.exhibitorsEstimated).toBe(true)
    })

    it('is false on published values', () => {
      const row = parseShowCsv(file(CECIL))[0]
      expect(row.boothFeeEstimated).toBe(false)
      expect(row.attendanceEstimated).toBe(false)
      expect(row.exhibitorsEstimated).toBe(false)
    })

    it('handles the * and the parenthetical note together', () => {
      const row = parseShowCsv(file(withField(CECIL, 10, '$750.00* (Contact)')))[0]
      expect(row.boothFee).toBe(750)
      expect(row.boothFeeEstimated).toBe(true)
      expect(row.boothFeeNote).toBe('Contact')
    })
  })

  describe('money', () => {
    it('strips $ and thousands separators above $1,000.00', () => {
      const row = parseShowCsv(file(withField(CECIL, 10, '$1,250.00')))[0]
      expect(row.boothFee).toBe(1250)
    })

    it('rejects a fee with no dollar sign', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 10, '350.00')))).toThrow(ShowImportError)
    })
  })

  describe('application deadline', () => {
    it('stores both a date and the original text when it is a date', () => {
      const row = parseShowCsv(file(withField(CECIL, 9, '08/15/2026')))[0]
      expect(row.applicationDeadline?.getMonth()).toBe(7)
      expect(row.applicationDeadline?.getDate()).toBe(15)
      expect(row.applicationDeadlineText).toBe('08/15/2026')
    })

    it('keeps prose as text with a null date', () => {
      for (const text of ['until full', 'Not listed']) {
        const row = parseShowCsv(file(withField(CECIL, 9, text)))[0]
        expect(row.applicationDeadline).toBeNull()
        expect(row.applicationDeadlineText).toBe(text)
      }
    })

    it('requires the cell to be non-empty', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 9, '')))).toThrow(
        /Application Deadline is required/
      )
    })
  })

  describe('file-level rejection', () => {
    it('rejects a header mismatch', () => {
      const bad = file(CECIL).replace('# of Exhibitors', 'Exhibitors')
      expect(() => parseShowCsv(bad)).toThrow(ShowImportError)
      expect(() => parseShowCsv(bad)).toThrow(/Header row does not match/)
    })

    it('rejects a row with the wrong field count', () => {
      expect(() => parseShowCsv(file(CECIL + ',extra'))).toThrow(/expected 20 fields, found 21/)
    })

    it('rejects an end date before the start date', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 7, '07/23/2026')))).toThrow(
        /End Date .* is before Start Date/
      )
    })

    it('rejects a date that is not MM/DD/YYYY', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 6, '7/24/2026')))).toThrow(
        /Start Date must be MM\/DD\/YYYY/
      )
    })

    it('rejects an overflowing date rather than rolling it forward', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 6, '02/31/2026')))).toThrow(
        /Start Date must be MM\/DD\/YYYY/
      )
    })

    it('rejects a lowercase or malformed state', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 4, 'md')))).toThrow(/ST must be two/)
      expect(() => parseShowCsv(file(withField(CECIL, 4, 'MDX')))).toThrow(/ST must be two/)
    })

    it('rejects a malformed drive time', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 5, '7h 4m')))).toThrow(/Drive-Time/)
    })

    it('rejects a non-absolute URL', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 19, '/33885/Cecil')))).toThrow(/absolute/)
      expect(() =>
        parseShowCsv(file(withField(CECIL, 19, 'http://festivalnet.com/33885')))
      ).toThrow(/absolute/)
    })

    it('rejects a URL repeated within the file', () => {
      const other = withField(CECIL, 0, 'Cecil County Fair (August)')
      expect(() => parseShowCsv(file(CECIL, other))).toThrow(/duplicate URL/)
    })

    it('rejects an empty required cell', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 0, '')))).toThrow(/Event Name is required/)
      expect(() => parseShowCsv(file(withField(CECIL, 16, '')))).toThrow(
        /Contact Name is required/
      )
    })

    it('allows an empty Venue, Address, Times and Contact Email', () => {
      let row = CECIL
      for (const i of [1, 2, 8, 17]) row = withField(row, i, '')
      const parsed = parseShowCsv(file(row))[0]
      expect(parsed.venue).toBeNull()
      expect(parsed.address).toBeNull()
      expect(parsed.times).toBeNull()
      expect(parsed.contactEmail).toBeNull()
    })

    it('rejects a malformed contact email', () => {
      expect(() => parseShowCsv(file(withField(CECIL, 17, 'not-an-email')))).toThrow(
        /not an email/
      )
    })

    it('names the offending line so the file can be fixed', () => {
      const bad = withField(withField(CECIL, 19, 'https://festivalnet.com/2'), 4, 'zz')
      try {
        parseShowCsv(file(CECIL, bad))
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ShowImportError)
        // Header is line 1, the good row line 2, the bad row line 3.
        expect((error as ShowImportError).line).toBe(3)
        expect((error as ShowImportError).message).toMatch(/^Line 3: /)
      }
    })

    it('rejects a header with no data rows', () => {
      expect(() => parseShowCsv(HEADER + '\r\n')).toThrow(/no shows/)
    })
  })

  it('parses several rows and preserves file order', () => {
    const second = withField(
      withField(CECIL, 0, 'Elkton Fall Fest'),
      19,
      'https://festivalnet.com/99999/Elkton-Maryland/Fall-Fest'
    )
    const rows = parseShowCsv(file(CECIL, second))
    expect(rows.map((r) => r.eventName)).toEqual(['Cecil County Fair', 'Elkton Fall Fest'])
    expect(rows.map((r) => r.lineNumber)).toEqual([2, 3])
  })
})
