import { describe, expect, it } from 'vitest'

import {
  parseLedgerAccountMap,
  resolveAccountIds,
  toNameOverrides,
  unmappedCategories,
  type LedgerAccountMapSetting,
} from '@/lib/quickbooks/ledger-accounts'
import { LEDGER_CATEGORY_VALUES } from '@/lib/financials/ledger'
import { resolveAccountMap } from '@/lib/financials/ledger-export'

import type { LedgerCategory } from '@prisma/client'

describe('parseLedgerAccountMap', () => {
  it('reads a well-formed map', () => {
    const parsed = parseLedgerAccountMap({
      PRODUCT_SALES: { accountId: '41', accountName: 'Salsa Sales', offsetId: '4', offsetName: 'Cash' },
    })
    expect(parsed.PRODUCT_SALES).toEqual({
      accountId: '41',
      accountName: 'Salsa Sales',
      offsetId: '4',
      offsetName: 'Cash',
    })
  })

  it('returns an empty map for anything that is not an object', () => {
    expect(parseLedgerAccountMap(null)).toEqual({})
    expect(parseLedgerAccountMap(undefined)).toEqual({})
    expect(parseLedgerAccountMap('PRODUCT_SALES')).toEqual({})
    expect(parseLedgerAccountMap([{ accountId: '41' }])).toEqual({})
  })

  it('drops keys that are not ledger categories', () => {
    // A category renamed or removed in the schema must not resurface as a phantom mapping.
    const parsed = parseLedgerAccountMap({
      PRODUCT_SALES: { accountId: '41' },
      LEGACY_CATEGORY: { accountId: '99' },
    })
    expect(Object.keys(parsed)).toEqual(['PRODUCT_SALES'])
  })

  it('treats blank and non-string values as absent rather than as an empty account id', () => {
    const parsed = parseLedgerAccountMap({
      TRAVEL: { accountId: '  ', accountName: 42, offsetId: '', offsetName: null },
    })
    expect(parsed.TRAVEL).toBeUndefined()
  })

  it('keeps a partially filled category, since a half-mapped map is a normal state', () => {
    const parsed = parseLedgerAccountMap({ MEALS: { accountId: '70' } })
    expect(parsed.MEALS?.accountId).toBe('70')
    expect(parsed.MEALS?.offsetId).toBeNull()
  })
})

describe('resolveAccountIds', () => {
  const map: LedgerAccountMapSetting = {
    SUPPLIES: { accountId: '63', offsetId: '35' },
    MEALS: { accountId: '70' },
  }

  it('returns both ids when the category is fully mapped', () => {
    expect(resolveAccountIds('SUPPLIES', map)).toEqual({ ok: true, accountId: '63', offsetId: '35' })
  })

  it('reports which side is missing', () => {
    expect(resolveAccountIds('MEALS', map)).toEqual({ ok: false, missing: 'offset' })
    expect(resolveAccountIds('TRAVEL', map)).toEqual({ ok: false, missing: 'account' })
  })

  it('never falls back to a default — the sync posts unreviewed, so a guess is unacceptable', () => {
    // The file export happily falls back (see resolveAccountMap); this deliberately does not.
    expect(resolveAccountMap().TRAVEL.account.length).toBeGreaterThan(0)
    expect(resolveAccountIds('TRAVEL', {}).ok).toBe(false)
  })
})

describe('toNameOverrides', () => {
  it('projects only the names, and only the ones that are set', () => {
    const overrides = toNameOverrides({
      PRODUCT_SALES: { accountId: '41', accountName: 'Salsa Sales', offsetId: '4', offsetName: null },
    })
    expect(overrides.PRODUCT_SALES).toEqual({ account: 'Salsa Sales' })
  })

  it('feeds resolveAccountMap so a mapped name wins and an unmapped one keeps its default', () => {
    const resolved = resolveAccountMap(
      toNameOverrides({ PRODUCT_SALES: { accountName: 'Salsa Sales' } })
    )
    expect(resolved.PRODUCT_SALES.account).toBe('Salsa Sales')
    expect(resolved.COGS.account).toBe('Cost of Goods Sold')
  })
})

describe('unmappedCategories', () => {
  it('lists everything not yet fully mapped', () => {
    const map: LedgerAccountMapSetting = { SUPPLIES: { accountId: '63', offsetId: '35' } }
    const missing = unmappedCategories(map)
    expect(missing).not.toContain('SUPPLIES')
    expect(missing).toContain('TRAVEL')
    expect(missing).toHaveLength(LEDGER_CATEGORY_VALUES.length - 1)
  })

  it('is empty once every category has both sides', () => {
    const full: LedgerAccountMapSetting = {}
    for (const c of LEDGER_CATEGORY_VALUES) full[c as LedgerCategory] = { accountId: '1', offsetId: '2' }
    expect(unmappedCategories(full)).toEqual([])
  })
})
