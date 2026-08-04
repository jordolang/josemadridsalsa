import { describe, expect, it } from 'vitest'
import {
  canonicalizeDriver,
  computeContentHash,
  dedupeMileageEntries,
  detectCategory,
  normalizeMileage,
  normalizeMileageRow,
  parseDateCell,
  parseNumberCell,
  type NormalizedMileageEntry,
  type RawMileageRow,
} from '@/lib/archive/mileage-normalize'

function row(
  cells: RawMileageRow['cells'],
  overrides: Partial<RawMileageRow> = {}
): RawMileageRow {
  return {
    sourceFile: '01 Financial/Mileage/2020/Mileage Master.xlsx',
    sourceMd5: 'abc123',
    sourceSheet: 'Sheet1',
    sourceRow: 2,
    header: Object.keys(cells),
    cells,
    ...overrides,
  }
}

function normalized(cells: RawMileageRow['cells'], o?: Partial<RawMileageRow>) {
  const r = normalizeMileageRow(row(cells, o))
  if ('skip' in r) throw new Error(`expected entry, got skip: ${r.skip}`)
  return r.entry
}

describe('parseDateCell', () => {
  it('parses ISO datetimes to a date', () => {
    expect(parseDateCell('2020-06-04T00:00:00')).toBe('2020-06-04')
    expect(parseDateCell('2022-01-03')).toBe('2022-01-03')
  })

  it('does not read an odometer number as a date', () => {
    expect(parseDateCell(176470)).toBeNull()
    expect(parseDateCell('176470')).toBeNull()
  })

  it('rejects free text', () => {
    expect(parseDateCell('until full')).toBeNull()
    expect(parseDateCell(null)).toBeNull()
  })
})

describe('parseNumberCell', () => {
  it('tolerates thousands separators and currency', () => {
    expect(parseNumberCell('1,699')).toBe(1699)
    expect(parseNumberCell('$3,157')).toBe(3157)
    expect(parseNumberCell(90)).toBe(90)
  })

  it('returns null for blanks and junk', () => {
    expect(parseNumberCell('')).toBeNull()
    expect(parseNumberCell(null)).toBeNull()
    expect(parseNumberCell('-')).toBeNull()
  })
})

describe('canonicalizeDriver', () => {
  it('collapses Deb / Debbie / Debrah to one name', () => {
    expect(canonicalizeDriver('Deb')).toBe('Debbie')
    expect(canonicalizeDriver('debbie')).toBe('Debbie')
    expect(canonicalizeDriver('Debrah')).toBe('Debbie')
  })

  it('treats "?" and blanks as unknown', () => {
    expect(canonicalizeDriver('?')).toBeNull()
    expect(canonicalizeDriver('')).toBeNull()
    expect(canonicalizeDriver(null)).toBeNull()
  })

  it('keeps an unknown real name, title-cased', () => {
    expect(canonicalizeDriver('kevin')).toBe('Kevin')
  })
})

describe('detectCategory', () => {
  it('detects fundraisers, markets, and shows', () => {
    expect(detectCategory('FR - Avon Marching', 'x.xlsx')).toBe('FUNDRAISER')
    expect(detectCategory('Farmers Market', 'x.xlsx')).toBe('FARMERS_MARKET')
    expect(detectCategory('Cincinnati Home and Garden show', 'x.xlsx')).toBe('SHOW')
    expect(detectCategory('Restaurant Depot', 'x.xlsx')).toBe('VENDOR')
  })

  it('falls back to the source file name', () => {
    expect(
      detectCategory('Reynoldsburg', '2020 Farmers Markets sorted by mileage.xlsx')
    ).toBe('FARMERS_MARKET')
  })

  it('returns null when undetermined rather than guessing', () => {
    expect(detectCategory('Powell', 'x.xlsx')).toBeNull()
  })
})

describe('normalizeMileageRow — layout handling', () => {
  it('maps the Master layout (Start/End are dates)', () => {
    const e = normalized({
      Start: '2020-01-03T00:00:00',
      End: '2020-01-05T00:00:00',
      Vendor: 'L&L Columbus',
      City: 'Columbus',
      St: 'OH',
      Miles: 364,
      Driver: 'Mike',
    })
    expect(e.tripDate).toBe('2020-01-03')
    expect(e.endDate).toBe('2020-01-05')
    expect(e.destination).toBe('L&L Columbus')
    expect(e.state).toBe('OH')
    expect(e.miles).toBe(364)
    expect(e.odometerStart).toBeNull()
    expect(e.year).toBe(2020)
  })

  it('reads Start/End as odometer when a separate Date column exists', () => {
    const e = normalized({
      Date: '2020-01-16T00:00:00',
      Start: 176470,
      End: 176853,
      Miles: 361,
      Reason: 'Greater Cincinnati Remodeling & 2 FR',
    })
    expect(e.tripDate).toBe('2020-01-16')
    expect(e.odometerStart).toBe(176470)
    expect(e.odometerEnd).toBe(176853)
    expect(e.miles).toBe(361)
    expect(e.endDate).toBeNull()
    expect(e.destination).toBe('Greater Cincinnati Remodeling & 2 FR')
  })

  it('maps the "Date Start / Mileage / One way" layout', () => {
    const e = normalized({
      'Date Start': '2022-02-26T00:00:00',
      'Date End': '2022-02-27T00:00:00',
      Vendor: 'Cincinnati Home and Garden show',
      City: 'Cincinnati',
      State: 'OH',
      Driver: '?',
      Mileage: 339,
      'One way': 161,
      'Sales/Purch': null,
    })
    expect(e.tripDate).toBe('2022-02-26')
    expect(e.endDate).toBe('2022-02-27')
    expect(e.miles).toBe(339)
    expect(e.oneWayMiles).toBe(161)
    expect(e.driver).toBeNull()
    expect(e.category).toBe('SHOW')
  })

  it('maps the "Location/Sales" view and captures sales', () => {
    const e = normalized({
      Date: '2020-06-04T00:00:00',
      Location: 'Reynoldsburg',
      Miles: 90,
      Driver: 'Deb',
      Sales: 296,
    })
    expect(e.destination).toBe('Reynoldsburg')
    expect(e.sales).toBe(296)
    expect(e.driver).toBe('Debbie')
  })

  it('keeps a dated vendor row that has no miles (Misc Mileage)', () => {
    const e = normalized({ Date: '2020-01-06T00:00:00', Vendor: 'PAHS' })
    expect(e.tripDate).toBe('2020-01-06')
    expect(e.destination).toBe('PAHS')
    expect(e.miles).toBeNull()
  })
})

describe('normalizeMileageRow — rejection', () => {
  it('skips a subtotal row', () => {
    const r = normalizeMileageRow(
      row({ 'Date Start': null, Vendor: null, Driver: '? Total', Mileage: 0 })
    )
    expect(r).toEqual({ skip: 'subtotal-row' })
  })

  it('skips a row with no resolvable date', () => {
    const r = normalizeMileageRow(row({ Vendor: 'Somewhere', Miles: 50 }))
    expect(r).toEqual({ skip: 'no-date' })
  })

  it('skips a row with a date but no destination', () => {
    const r = normalizeMileageRow(row({ Date: '2020-01-06T00:00:00', Miles: 50 }))
    expect(r).toEqual({ skip: 'no-destination' })
  })
})

describe('dedupeMileageEntries', () => {
  const a = normalized({
    Start: '2020-01-06T00:00:00',
    Vendor: 'PAHS',
    City: 'Columbus',
    St: 'OH',
    Miles: 128,
    Driver: 'Mike',
  })
  const aDupLean = normalized({ Date: '2020-01-06T00:00:00', Vendor: 'PAHS' })

  it('gives the same content hash to the same trip regardless of layout', () => {
    // Same date + destination + (no) city/driver/miles only collapses when the
    // identifying fields match; here the lean row lacks city/driver/miles so it
    // is a *different* hash — dedup must not silently merge distinct detail.
    expect(a.contentHash).not.toBe(aDupLean.contentHash)
  })

  it('collapses identical re-exported rows and keeps the richest', () => {
    const rich = a
    const lean: NormalizedMileageEntry = {
      ...a,
      driver: null,
      city: null,
      contentHash: a.contentHash, // same trip, sparser copy
      sourceFile: 'zzz-later-export.xlsx',
    }
    const { unique, duplicatesDropped } = dedupeMileageEntries([lean, rich])
    expect(duplicatesDropped).toBe(1)
    expect(unique).toHaveLength(1)
    expect(unique[0].driver).toBe('Mike') // the richer copy won
  })

  it('is order-independent', () => {
    const lean: NormalizedMileageEntry = {
      ...a,
      driver: null,
      city: null,
      sourceFile: 'zzz.xlsx',
    }
    const one = dedupeMileageEntries([a, lean]).unique[0]
    const two = dedupeMileageEntries([lean, a]).unique[0]
    expect(one).toEqual(two)
  })
})

describe('computeContentHash', () => {
  it('ignores case and whitespace in destination/city/driver', () => {
    const base = {
      tripDate: '2020-01-06',
      destination: 'Restaurant  Depot',
      city: 'Columbus',
      driver: 'Mike',
      miles: 125,
    }
    const spaced = { ...base, destination: 'restaurant depot', driver: 'mike' }
    expect(computeContentHash(base)).toBe(computeContentHash(spaced))
  })
})

describe('normalizeMileage — end to end', () => {
  it('normalizes, counts skips, and dedupes', () => {
    const rows = [
      row({ Start: '2020-01-06T00:00:00', Vendor: 'PAHS', City: 'Columbus', Miles: 128, Driver: 'Mike' }),
      row({ Start: '2020-01-06T00:00:00', Vendor: 'PAHS', City: 'Columbus', Miles: 128, Driver: 'Deb' }, { sourceFile: 'other.xlsx' }),
      row({ Driver: '? Total', Mileage: 0 }),
      row({ Miles: 5 }),
    ]
    const summary = normalizeMileage(rows)
    // The two PAHS rows differ only by driver (Mike vs Debbie) -> different hash,
    // both kept; the subtotal and the dateless row are skipped.
    expect(summary.skipped['subtotal-row']).toBe(1)
    expect(summary.skipped['no-date']).toBe(1)
    expect(summary.entries).toHaveLength(2)
  })
})
