import { describe, expect, it } from 'vitest'

import {
  CATEGORY_DIRECTION,
  archivedShowSaleToLedgerDrafts,
  dollarsToCents,
  orderToLedgerDrafts,
  profitAndLoss,
  refundToLedgerDraft,
  summariseLedger,
  type OrderLedgerInput,
} from '@/lib/financials/ledger'

const baseOrder: OrderLedgerInput = {
  orderId: 'ord_1',
  orderNumber: 'JMS-20260813-1001',
  date: new Date('2026-08-13T12:00:00Z'),
  channel: 'WEBSITE',
  counterparty: 'Jane Buyer',
  paymentMethod: 'card',
  subtotalCents: 5400,
  shippingCents: 699,
  taxCents: 432,
  discountCents: 0,
  cogsCents: 2000,
  processorFeeCents: 186,
}

describe('dollarsToCents', () => {
  it('rounds dollars to whole cents', () => {
    expect(dollarsToCents(54)).toBe(5400)
    expect(dollarsToCents(6.99)).toBe(699)
    expect(dollarsToCents(0.1 + 0.2)).toBe(30) // survives float error
  })

  it('treats a non-finite value as zero', () => {
    expect(dollarsToCents(NaN)).toBe(0)
  })
})

describe('orderToLedgerDrafts', () => {
  it('splits an order into revenue and cost rows on the right sides', () => {
    const drafts = orderToLedgerDrafts(baseOrder)
    const byCategory = Object.fromEntries(drafts.map((d) => [d.category, d]))

    expect(byCategory.PRODUCT_SALES.amountCents).toBe(5400)
    expect(byCategory.PRODUCT_SALES.direction).toBe('INCOME')
    expect(byCategory.SHIPPING_INCOME.amountCents).toBe(699)
    expect(byCategory.SALES_TAX_COLLECTED.amountCents).toBe(432)
    expect(byCategory.COGS.amountCents).toBe(2000)
    expect(byCategory.COGS.direction).toBe('EXPENSE')
    expect(byCategory.PROCESSOR_FEES.amountCents).toBe(186)
    expect(byCategory.PROCESSOR_FEES.direction).toBe('EXPENSE')
  })

  it('carries stable, unique dedupe keys so a re-run updates rather than duplicates', () => {
    const keys = orderToLedgerDrafts(baseOrder).map((d) => d.dedupeKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('order:ord_1:product_sales')
    expect(keys).toContain('order:ord_1:processor_fees')
  })

  it('emits no row for a zero component', () => {
    const drafts = orderToLedgerDrafts({
      ...baseOrder,
      shippingCents: 0,
      taxCents: 0,
      discountCents: 0,
      cogsCents: 0,
      processorFeeCents: 0,
    })
    expect(drafts.map((d) => d.category)).toEqual(['PRODUCT_SALES'])
  })

  it('records a discount as a contra (expense-side) row', () => {
    const drafts = orderToLedgerDrafts({ ...baseOrder, discountCents: 500 })
    const discount = drafts.find((d) => d.category === 'DISCOUNTS')
    expect(discount?.direction).toBe('EXPENSE')
    expect(discount?.amountCents).toBe(500)
  })

  it('carries channel and counterparty onto every row', () => {
    const drafts = orderToLedgerDrafts(baseOrder)
    expect(drafts.every((d) => d.channel === 'WEBSITE' && d.counterparty === 'Jane Buyer')).toBe(true)
  })
})

describe('refundToLedgerDraft', () => {
  it('produces a single contra-income row', () => {
    const d = refundToLedgerDraft({
      refundId: 'ref_1',
      date: new Date('2026-08-14T00:00:00Z'),
      amountCents: 1200,
      orderNumber: 'JMS-20260813-1001',
    })
    expect(d?.category).toBe('REFUNDS')
    expect(d?.direction).toBe('EXPENSE')
    expect(d?.amountCents).toBe(1200)
    expect(d?.dedupeKey).toBe('refund:ref_1:refunds')
  })

  it('ignores a zero or negative refund', () => {
    expect(
      refundToLedgerDraft({ refundId: 'ref_0', date: new Date(), amountCents: 0 })
    ).toBeNull()
  })
})

describe('archivedShowSaleToLedgerDrafts', () => {
  it('records show sales in and expenses out', () => {
    const drafts = archivedShowSaleToLedgerDrafts({
      id: 'show_1',
      date: new Date('2024-07-04T00:00:00Z'),
      showName: 'Zanesville Festival',
      salesCents: 120000,
      expensesCents: 25000,
      salesPerson: 'Crew',
    })
    const cats = drafts.map((d) => d.category)
    expect(cats).toEqual(['SHOW_SALES', 'SHOW_EXPENSES'])
    expect(drafts[0].direction).toBe('INCOME')
    expect(drafts[1].direction).toBe('EXPENSE')
  })

  it('omits a side that is zero', () => {
    const drafts = archivedShowSaleToLedgerDrafts({
      id: 'show_2',
      date: new Date('2023-01-01T00:00:00Z'),
      showName: 'Market',
      salesCents: 5000,
      expensesCents: 0,
    })
    expect(drafts.map((d) => d.category)).toEqual(['SHOW_SALES'])
  })
})

describe('CATEGORY_DIRECTION', () => {
  it('agrees with the direction every mapper assigns', () => {
    const all = [
      ...orderToLedgerDrafts({ ...baseOrder, discountCents: 300 }),
      refundToLedgerDraft({ refundId: 'r', date: new Date(), amountCents: 100 })!,
      ...archivedShowSaleToLedgerDrafts({
        id: 's',
        date: new Date(),
        showName: 'x',
        salesCents: 100,
        expensesCents: 100,
      }),
    ]
    for (const d of all) expect(d.direction).toBe(CATEGORY_DIRECTION[d.category])
  })
})

describe('summariseLedger & profitAndLoss', () => {
  const entries = [
    ...orderToLedgerDrafts(baseOrder),
    refundToLedgerDraft({ refundId: 'ref_1', date: new Date(), amountCents: 699 })!,
  ]

  it('nets income against expenses (COGS + fee + refund)', () => {
    const s = summariseLedger(entries)
    // income: 5400 + 699 + 432 = 6531; expense: 2000 + 186 + 699 = 2885
    expect(s.incomeCents).toBe(6531)
    expect(s.expenseCents).toBe(2885)
    expect(s.netCents).toBe(3646)
  })

  it('builds a P&L with income and expense lines sorted by size', () => {
    const pl = profitAndLoss(entries)
    expect(pl.totalIncomeCents).toBe(6531)
    expect(pl.totalExpenseCents).toBe(2885)
    expect(pl.netCents).toBe(3646)
    expect(pl.income[0].category).toBe('PRODUCT_SALES') // largest income line first
    expect(pl.income.every((l) => CATEGORY_DIRECTION[l.category] === 'INCOME')).toBe(true)
    expect(pl.expenses.every((l) => CATEGORY_DIRECTION[l.category] === 'EXPENSE')).toBe(true)
  })

  it('reports a loss as a negative net', () => {
    const s = summariseLedger([
      { direction: 'INCOME', amountCents: 100, category: 'PRODUCT_SALES' },
      { direction: 'EXPENSE', amountCents: 250, category: 'BOOTH_FEE' },
    ])
    expect(s.netCents).toBe(-150)
  })
})
