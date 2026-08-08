import { describe, expect, it } from 'vitest'

import {
  FEE_LOOKUP_MAX_AGE_DAYS,
  isWorthCheckingFee,
  readSquareFee,
} from '@/lib/payments/processor-fees'

describe('readSquareFee', () => {
  it('sums the fee entries, since a payment can carry more than one', () => {
    expect(
      readSquareFee({
        processing_fee: [
          { amount_money: { amount: 320 } },
          { amount_money: { amount: 15 } },
        ],
      }).feeCents
    ).toBe(335)
  })

  it('handles the bigint amounts the Square SDK returns', () => {
    expect(readSquareFee({ processing_fee: [{ amount_money: { amount: 320n } }] }).feeCents).toBe(
      320
    )
  })

  it('returns null when Square has not settled the fee yet', () => {
    // The common case right after payment.completed — not a zero-fee payment.
    expect(readSquareFee({ processing_fee: null }).feeCents).toBeNull()
    expect(readSquareFee({}).feeCents).toBeNull()
    expect(readSquareFee({ processing_fee: [] }).feeCents).toBeNull()
  })

  it('explains why it could not read a fee', () => {
    expect(readSquareFee({ processing_fee: [] }).reason).toContain('not settled')
  })

  it('refuses to guess when an entry is missing its amount', () => {
    // Partial data would produce a fee that is too low, which overstates profit.
    const result = readSquareFee({ processing_fee: [{ amount_money: { amount: 320 } }, {}] })
    expect(result.feeCents).toBeNull()
    expect(result.reason).toContain('missing an amount')
  })
})

describe('isWorthCheckingFee', () => {
  const now = new Date('2026-08-08T12:00:00.000Z')
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000)
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)

  it('checks a recent payment with no fee recorded', () => {
    expect(
      isWorthCheckingFee({
        paidAt: hoursAgo(6),
        createdAt: hoursAgo(6),
        processorFee: null,
        processorFeeCheckedAt: null,
        now,
      })
    ).toBe(true)
  })

  it('skips a payment whose fee is already known', () => {
    expect(
      isWorthCheckingFee({
        paidAt: hoursAgo(6),
        createdAt: hoursAgo(6),
        processorFee: 320,
        processorFeeCheckedAt: null,
        now,
      })
    ).toBe(false)
  })

  it('treats a known zero fee as known', () => {
    // Zero is an answer. Only null means we have not been told.
    expect(
      isWorthCheckingFee({
        paidAt: hoursAgo(6),
        createdAt: hoursAgo(6),
        processorFee: 0,
        processorFeeCheckedAt: null,
        now,
      })
    ).toBe(false)
  })

  it('gives up past the age limit rather than re-querying dead payments forever', () => {
    expect(
      isWorthCheckingFee({
        paidAt: daysAgo(FEE_LOOKUP_MAX_AGE_DAYS + 1),
        createdAt: daysAgo(FEE_LOOKUP_MAX_AGE_DAYS + 1),
        processorFee: null,
        processorFeeCheckedAt: null,
        now,
      })
    ).toBe(false)
  })

  it('does not re-ask within the hour', () => {
    expect(
      isWorthCheckingFee({
        paidAt: hoursAgo(6),
        createdAt: hoursAgo(6),
        processorFee: null,
        processorFeeCheckedAt: hoursAgo(0.5),
        now,
      })
    ).toBe(false)
  })

  it('asks again once an hour has passed', () => {
    expect(
      isWorthCheckingFee({
        paidAt: hoursAgo(6),
        createdAt: hoursAgo(6),
        processorFee: null,
        processorFeeCheckedAt: hoursAgo(2),
        now,
      })
    ).toBe(true)
  })

  it('falls back to createdAt when a payment has no paidAt', () => {
    expect(
      isWorthCheckingFee({
        paidAt: null,
        createdAt: daysAgo(FEE_LOOKUP_MAX_AGE_DAYS + 1),
        processorFee: null,
        processorFeeCheckedAt: null,
        now,
      })
    ).toBe(false)
  })
})
