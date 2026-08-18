import { describe, expect, it } from 'vitest'

import {
  buildContactOrderBy,
  buildContactWhere,
  buildMailableWhere,
  resolvePage,
  resolvePageSize,
  resolveSortColumn,
  resolveSortDirection,
} from '@/lib/fundraising/contact-list'

describe('resolvers', () => {
  it('falls back to the defaults for anything unrecognized', () => {
    expect(resolveSortColumn('nonsense')).toBe('jars')
    expect(resolveSortColumn(undefined)).toBe('jars')
    expect(resolveSortColumn('organization')).toBe('organization')
    expect(resolveSortDirection('sideways')).toBe('desc')
    expect(resolveSortDirection('asc')).toBe('asc')
  })

  it('refuses page sizes that are not on the menu', () => {
    expect(resolvePageSize('100')).toBe(100)
    // An arbitrary size would let a crafted URL ask for every row at once.
    expect(resolvePageSize('100000')).toBe(100)
    expect(resolvePageSize('abc')).toBe(100)
  })

  it('clamps page numbers to something that exists', () => {
    expect(resolvePage('3')).toBe(3)
    expect(resolvePage('0')).toBe(1)
    expect(resolvePage('-2')).toBe(1)
    expect(resolvePage(undefined)).toBe(1)
  })
})

describe('buildContactWhere', () => {
  it('is empty for an empty view', () => {
    expect(buildContactWhere({})).toEqual({})
  })

  it('searches organization, contact, email and phone together', () => {
    const where = buildContactWhere({ search: 'anderson' })
    const or = where.AND?.[0]?.OR
    expect(or).toHaveLength(4)
    expect(JSON.stringify(or)).toContain('anderson')
  })

  it('strips formatting before searching a phone number', () => {
    const where = buildContactWhere({ search: '(740) 521-4304' })
    expect(JSON.stringify(where.AND?.[0]?.OR)).toContain('7405214304')
  })

  it('ignores a status or source that is not a real enum value', () => {
    const where = buildContactWhere({ status: 'DROP TABLE', source: 'bogus' })
    expect(where.status).toBeUndefined()
    expect(where.source).toBeUndefined()
  })

  it('accepts the real enum values', () => {
    expect(buildContactWhere({ status: 'DO_NOT_CONTACT' }).status).toBe('DO_NOT_CONTACT')
    expect(buildContactWhere({ source: 'WEBSITE_EXPORT' }).source).toBe('WEBSITE_EXPORT')
  })

  it('treats a blank email string as "no email" in both directions', () => {
    expect(buildContactWhere({ hasEmail: 'no' }).AND).toEqual([
      { OR: [{ email: null }, { email: '' }] },
    ])
    expect(buildContactWhere({ hasEmail: 'yes' }).AND).toEqual([
      { NOT: [{ email: null }, { email: '' }] },
    ])
  })

  it('maps the active filter onto the boolean, and omits it when unset', () => {
    expect(buildContactWhere({ active: 'active' }).isActive).toBe(true)
    expect(buildContactWhere({ active: 'inactive' }).isActive).toBe(false)
    expect(buildContactWhere({ active: 'all' }).isActive).toBeUndefined()
  })

  it('filters by campaign year and ignores a non-numeric one', () => {
    expect(buildContactWhere({ year: '2024' }).years).toEqual({ has: 2024 })
    expect(buildContactWhere({ year: 'last year' }).years).toBeUndefined()
  })
})

describe('buildMailableWhere', () => {
  it('never returns inactive, opted-out, or address-less contacts', () => {
    const where = buildMailableWhere({})
    expect(where.AND).toEqual([
      {},
      { isActive: true },
      { status: { not: 'DO_NOT_CONTACT' } },
      { NOT: [{ email: null }, { email: '' }] },
    ])
  })

  it('still honours the on-screen filters, so the send matches the view', () => {
    const where = buildMailableWhere({ year: '2024' })
    expect(where.AND?.[0]).toEqual({ years: { has: 2024 } })
  })

  it('cannot be talked out of its guards by a filter', () => {
    // A crafted `active=inactive` must not produce a mailable set of inactive rows.
    const where = buildMailableWhere({ active: 'inactive' })
    expect(where.AND).toContainEqual({ isActive: true })
  })
})

describe('buildContactOrderBy', () => {
  it('pushes blanks to the end of nullable columns in both directions', () => {
    expect(buildContactOrderBy('lastCampaign', 'asc')[0]).toEqual({
      lastCampaignAt: { sort: 'asc', nulls: 'last' },
    })
    expect(buildContactOrderBy('lastCampaign', 'desc')[0]).toEqual({
      lastCampaignAt: { sort: 'desc', nulls: 'last' },
    })
  })

  it('always adds a tie-break so paging is stable', () => {
    for (const column of ['jars', 'contact', 'email', 'campaigns', 'status'] as const) {
      expect(buildContactOrderBy(column, 'desc')).toHaveLength(2)
    }
  })

  it('sorts by jars descending by default', () => {
    expect(buildContactOrderBy('jars', 'desc')[0]).toEqual({ totalJars: 'desc' })
  })
})
