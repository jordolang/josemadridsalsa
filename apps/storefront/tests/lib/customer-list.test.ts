import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  buildCustomerOrderBy,
  buildCustomerWhere,
  isSortColumn,
  resolvePage,
  resolvePageSize,
  resolveSortColumn,
  resolveSortDirection,
  subscriberStatusFor,
} from '@/lib/customers/customer-list'

describe('sort column whitelist', () => {
  it('accepts known columns', () => {
    expect(isSortColumn('accountType')).toBe(true)
    expect(isSortColumn('spent')).toBe(true)
  })

  it('rejects anything not on the list', () => {
    expect(isSortColumn('notes')).toBe(false)
    expect(isSortColumn('id; drop table customers')).toBe(false)
    expect(isSortColumn(undefined)).toBe(false)
  })

  it('falls back to the default rather than passing a raw param through', () => {
    expect(resolveSortColumn('nonsense')).toBe(DEFAULT_SORT)
    expect(resolveSortColumn('phone')).toBe('phone')
  })

  it('only allows asc or desc', () => {
    expect(resolveSortDirection('asc')).toBe('asc')
    expect(resolveSortDirection('desc')).toBe('desc')
    expect(resolveSortDirection('sideways')).toBe('desc')
  })
})

describe('buildCustomerOrderBy', () => {
  it('sorts people by last name, then first, then email', () => {
    expect(buildCustomerOrderBy('customer', 'asc')).toEqual([
      { lastName: { sort: 'asc', nulls: 'last' } },
      { firstName: { sort: 'asc', nulls: 'last' } },
      { email: 'asc' },
    ])
  })

  it('keeps blank values last in both directions', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const [first] = buildCustomerOrderBy('phone', dir)
      expect(first).toEqual({ phone: { sort: dir, nulls: 'last' } })
    }
  })

  it('always ends with a stable tie-breaker so paging does not reshuffle', () => {
    for (const column of ['accountType', 'source', 'orders', 'spent'] as const) {
      const order = buildCustomerOrderBy(column, 'desc')
      expect(order[order.length - 1]).toEqual({ email: 'asc' })
    }
  })

  it('covers every whitelisted column', () => {
    expect(buildCustomerOrderBy('lastOrder', 'desc')[0]).toEqual({
      lastOrderAt: { sort: 'desc', nulls: 'last' },
    })
    expect(buildCustomerOrderBy('email', 'asc')).toEqual([{ email: 'asc' }])
  })
})

describe('page sizing', () => {
  it('defaults to a long page', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(500)
    expect(resolvePageSize(undefined)).toBe(500)
  })

  it('accepts only offered sizes', () => {
    expect(resolvePageSize('1000')).toBe(1000)
    expect(resolvePageSize('100')).toBe(100)
    // An arbitrary size would let a query string ask for the whole table.
    expect(resolvePageSize('50000')).toBe(500)
    expect(resolvePageSize('7')).toBe(500)
  })

  it('clamps the page number to a positive integer', () => {
    expect(resolvePage('3')).toBe(3)
    expect(resolvePage('0')).toBe(1)
    expect(resolvePage('-2')).toBe(1)
    expect(resolvePage('abc')).toBe(1)
  })
})

describe('buildCustomerWhere', () => {
  it('is empty with no filters', () => {
    expect(buildCustomerWhere({})).toEqual({})
  })

  it('searches across name, email, phone and organization', () => {
    const where = buildCustomerWhere({ search: 'hardin' })
    expect(where.OR).toHaveLength(5)
    expect(where.OR).toContainEqual({
      sourceName: { contains: 'hardin', mode: 'insensitive' },
    })
  })

  it('ignores a whitespace-only search', () => {
    expect(buildCustomerWhere({ search: '   ' })).toEqual({})
  })

  it('applies known enum filters', () => {
    expect(buildCustomerWhere({ accountType: 'WHOLESALE' })).toEqual({
      accountType: 'WHOLESALE',
    })
    expect(buildCustomerWhere({ source: 'IMPORT' })).toEqual({ source: 'IMPORT' })
  })

  it('drops unknown enum values instead of sending them to the database', () => {
    expect(buildCustomerWhere({ accountType: 'all' })).toEqual({})
    expect(buildCustomerWhere({ source: 'BOGUS' })).toEqual({})
  })
})

describe('subscriberStatusFor', () => {
  it('carries an unsubscribe onto the mailing list', () => {
    expect(subscriberStatusFor('Unsubscribed')).toBe('UNSUBSCRIBED')
  })

  it('treats removed and suppressed as unmailable too', () => {
    expect(subscriberStatusFor('Removed')).toBe('UNSUBSCRIBED')
    expect(subscriberStatusFor('Suppressed')).toBe('UNSUBSCRIBED')
    expect(subscriberStatusFor('Pending')).toBe('UNSUBSCRIBED')
  })

  it('maps bounces and complaints to their own statuses', () => {
    expect(subscriberStatusFor('Bounced')).toBe('BOUNCED')
    expect(subscriberStatusFor('complained')).toBe('COMPLAINED')
  })

  it('subscribes the recognisably mailable', () => {
    expect(subscriberStatusFor('Active')).toBe('SUBSCRIBED')
    expect(subscriberStatusFor('Implied')).toBe('SUBSCRIBED')
    expect(subscriberStatusFor('Express')).toBe('SUBSCRIBED')
    expect(subscriberStatusFor(null)).toBe('SUBSCRIBED')
  })

  it('fails closed on anything it does not recognise', () => {
    expect(subscriberStatusFor('who knows')).toBe('UNSUBSCRIBED')
  })
})
