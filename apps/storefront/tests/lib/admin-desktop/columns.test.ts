import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import {
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  clampWidth,
  columnKey,
  gridTemplate,
  hasCustomWidths,
  readColumnWidths,
  trackFor,
  withColumnWidth,
  withoutColumnWidth,
  withoutSectionWidths,
  writeColumnWidths,
  type ColumnWidths,
} from '@/lib/admin-desktop/columns'
import type { Column } from '@/lib/admin-desktop/types'

const columns: Column[] = [
  { label: 'Order', width: '104px' },
  { label: 'Customer', width: 'minmax(0,1.5fr)' },
  { label: 'Total', width: '92px', right: true },
]

describe('column tracks', () => {
  it('uses the loader’s track until the operator drags one', () => {
    expect(gridTemplate(columns, undefined)).toBe('104px minmax(0,1.5fr) 92px')
  })

  it('replaces a flexible track with an absolute width once it is dragged', () => {
    // The point of storing pixels: the moment somebody sizes a column by hand
    // they have said they want it that wide, not that share of what is left.
    expect(gridTemplate(columns, { Customer: 320 })).toBe('104px 320px 92px')
  })

  it('keys a column by its explicit key, falling back to the label', () => {
    expect(columnKey({ label: 'Total', width: '92px' }, 2)).toBe('Total')
    expect(columnKey({ key: 'total', label: 'Total', width: '92px' }, 2)).toBe('total')
  })

  it('leaves a column alone when the stored widths name a different one', () => {
    expect(trackFor(columns[1], 1, { Order: 200 })).toBe('minmax(0,1.5fr)')
  })
})

describe('clamping', () => {
  it('keeps a column wide enough to read', () => {
    expect(clampWidth(4)).toBe(MIN_COLUMN_WIDTH)
    expect(clampWidth(-500)).toBe(MIN_COLUMN_WIDTH)
  })

  it('stops a drag from running off the pane', () => {
    expect(clampWidth(50_000)).toBe(MAX_COLUMN_WIDTH)
  })

  it('honours a column’s own floor when it is higher than the global one', () => {
    expect(clampWidth(60, { label: 'Placed', width: '112px', minWidth: 90 })).toBe(90)
  })

  it('rounds to whole pixels so a stored width is stable across reloads', () => {
    expect(clampWidth(213.6)).toBe(214)
  })
})

describe('editing the stored widths', () => {
  const start: ColumnWidths = { orders: { Customer: 320 }, products: { Name: 200 } }

  it('sets one column without touching the rest', () => {
    const next = withColumnWidth(start, 'orders', 'Total', 120)
    expect(next.orders).toEqual({ Customer: 320, Total: 120 })
    expect(next.products).toBe(start.products)
    // The original is left as it was, so React sees a new object and re-renders.
    expect(start.orders).toEqual({ Customer: 320 })
  })

  it('drops one column back to its default track', () => {
    const next = withoutColumnWidth(start, 'orders', 'Customer')
    expect(next.orders).toBeUndefined()
    expect(next.products).toEqual({ Name: 200 })
  })

  it('returns the same object when there is nothing to drop', () => {
    expect(withoutColumnWidth(start, 'orders', 'Nothing')).toBe(start)
    expect(withoutSectionWidths(start, 'ledger')).toBe(start)
  })

  it('clears a whole section', () => {
    const next = withoutSectionWidths(start, 'orders')
    expect(next).toEqual({ products: { Name: 200 } })
  })

  it('knows whether a section has been customised', () => {
    expect(hasCustomWidths(start, 'orders')).toBe(true)
    expect(hasCustomWidths(start, 'ledger')).toBe(false)
  })
})

describe('storage', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips what was written', () => {
    writeColumnWidths({ orders: { Customer: 320 } })
    expect(readColumnWidths()).toEqual({ orders: { Customer: 320 } })
  })

  it('reads nothing as an empty set rather than throwing', () => {
    expect(readColumnWidths()).toEqual({})
  })

  it('survives a corrupt entry', () => {
    // Column widths are a convenience. Losing them is fine; taking the admin
    // window down over a half-written localStorage entry is not.
    store.set('jms-desktop-columns', '{not json')
    expect(readColumnWidths()).toEqual({})
  })

  it('drops values that are not usable widths', () => {
    store.set(
      'jms-desktop-columns',
      JSON.stringify({ orders: { Customer: 'wide', Total: 120 }, products: 'nope' }),
    )
    expect(readColumnWidths()).toEqual({ orders: { Total: 120 } })
  })

  it('clamps a hand-edited width on the way in', () => {
    store.set('jms-desktop-columns', JSON.stringify({ orders: { Customer: 99_999 } }))
    expect(readColumnWidths()).toEqual({ orders: { Customer: MAX_COLUMN_WIDTH } })
  })

  it('does not throw when the browser refuses to store anything', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
    })
    expect(() => writeColumnWidths({ orders: { Customer: 320 } })).not.toThrow()
  })
})
