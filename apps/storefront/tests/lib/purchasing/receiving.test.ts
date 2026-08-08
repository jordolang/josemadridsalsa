import { describe, expect, it } from 'vitest'

import {
  canReceive,
  derivePurchaseOrderStatus,
  deriveReceiptProgress,
  generatePoNumber,
  projectLinesAfterReceipt,
  purchaseOrderSubtotalCents,
  remainingToReceive,
  validateReceipt,
} from '@/lib/purchasing/receiving'

const line = (id: string, ordered: number, received = 0) => ({
  id,
  quantityOrdered: ordered,
  quantityReceived: received,
})

describe('remainingToReceive', () => {
  it('reports what is still outstanding', () => {
    expect(remainingToReceive(line('a', 10, 4))).toBe(6)
  })

  it('reports zero for a fully received line', () => {
    expect(remainingToReceive(line('a', 10, 10))).toBe(0)
  })

  it('never goes negative, even if data is already over-received', () => {
    // Defensive against historical bad data, not an expected state.
    expect(remainingToReceive(line('a', 10, 12))).toBe(0)
  })
})

describe('canReceive', () => {
  it('allows receiving against submitted and partially received orders', () => {
    expect(canReceive('SUBMITTED')).toBe(true)
    expect(canReceive('PARTIALLY_RECEIVED')).toBe(true)
  })

  it('refuses drafts, completed and cancelled orders', () => {
    expect(canReceive('DRAFT')).toBe(false)
    expect(canReceive('RECEIVED')).toBe(false)
    expect(canReceive('CANCELLED')).toBe(false)
  })
})

describe('deriveReceiptProgress', () => {
  it('reports NONE before anything arrives', () => {
    expect(deriveReceiptProgress([line('a', 10), line('b', 5)])).toBe('NONE')
  })

  it('reports PARTIAL when some of one line arrived', () => {
    expect(deriveReceiptProgress([line('a', 10, 3), line('b', 5)])).toBe('PARTIAL')
  })

  it('reports PARTIAL when one whole line arrived but another has not', () => {
    expect(deriveReceiptProgress([line('a', 10, 10), line('b', 5)])).toBe('PARTIAL')
  })

  it('reports COMPLETE only when every line is fully received', () => {
    expect(deriveReceiptProgress([line('a', 10, 10), line('b', 5, 5)])).toBe('COMPLETE')
  })

  it('reports NONE for an order with no lines', () => {
    // "Every line received" is vacuously true of no lines. Calling that COMPLETE would let
    // an empty draft close itself.
    expect(deriveReceiptProgress([])).toBe('NONE')
  })
})

describe('derivePurchaseOrderStatus', () => {
  it('moves a submitted order to partially received on a first partial delivery', () => {
    expect(derivePurchaseOrderStatus('SUBMITTED', [line('a', 10, 3)])).toBe('PARTIALLY_RECEIVED')
  })

  it('moves to received once everything has arrived', () => {
    expect(derivePurchaseOrderStatus('SUBMITTED', [line('a', 10, 10)])).toBe('RECEIVED')
  })

  it('keeps a submitted order submitted when nothing has arrived', () => {
    expect(derivePurchaseOrderStatus('SUBMITTED', [line('a', 10)])).toBe('SUBMITTED')
  })

  it('leaves a cancelled order alone', () => {
    // A late receipt must not resurrect a cancelled order, the same way a late carrier
    // webhook does not resurrect a cancelled sale.
    expect(derivePurchaseOrderStatus('CANCELLED', [line('a', 10, 10)])).toBeNull()
  })

  it('leaves a draft alone', () => {
    expect(derivePurchaseOrderStatus('DRAFT', [line('a', 10, 10)])).toBeNull()
  })
})

describe('validateReceipt', () => {
  const orderLines = [line('a', 10, 2), line('b', 5)]

  it('accepts a receipt within what is outstanding', () => {
    const result = validateReceipt({
      status: 'SUBMITTED',
      lines: [{ purchaseOrderItemId: 'a', quantity: 8 }],
      orderLines,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.quantities.get('a')).toBe(8)
  })

  it('refuses a draft purchase order', () => {
    const result = validateReceipt({
      status: 'DRAFT',
      lines: [{ purchaseOrderItemId: 'a', quantity: 1 }],
      orderLines,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('not_receivable')
  })

  it('refuses a receipt with nothing on it', () => {
    const result = validateReceipt({ status: 'SUBMITTED', lines: [], orderLines })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('empty')
  })

  it('ignores zero quantities but refuses if that leaves nothing', () => {
    const result = validateReceipt({
      status: 'SUBMITTED',
      lines: [{ purchaseOrderItemId: 'a', quantity: 0 }],
      orderLines,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('empty')
  })

  it('refuses a line that is not on the order', () => {
    const result = validateReceipt({
      status: 'SUBMITTED',
      lines: [{ purchaseOrderItemId: 'nope', quantity: 1 }],
      orderLines,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown_line')
  })

  it('refuses the same line submitted twice in one receipt', () => {
    const result = validateReceipt({
      status: 'SUBMITTED',
      lines: [
        { purchaseOrderItemId: 'a', quantity: 2 },
        { purchaseOrderItemId: 'a', quantity: 3 },
      ],
      orderLines,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('duplicate_line')
  })

  it('refuses over-receipt rather than clamping it', () => {
    // Clamping would push quantityReceived past quantityOrdered and corrupt every count
    // derived from it. It usually also means the wrong line was picked.
    const result = validateReceipt({
      status: 'SUBMITTED',
      lines: [{ purchaseOrderItemId: 'a', quantity: 9 }],
      orderLines,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('over_receipt')
      expect(result.error.message).toContain('8')
    }
  })

  it('explains a fully received line differently from a partial overshoot', () => {
    const result = validateReceipt({
      status: 'PARTIALLY_RECEIVED',
      lines: [{ purchaseOrderItemId: 'done', quantity: 1 }],
      orderLines: [line('done', 4, 4)],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('already been received in full')
  })

  it('accepts receiving exactly the outstanding balance', () => {
    const result = validateReceipt({
      status: 'PARTIALLY_RECEIVED',
      lines: [
        { purchaseOrderItemId: 'a', quantity: 8 },
        { purchaseOrderItemId: 'b', quantity: 5 },
      ],
      orderLines,
    })
    expect(result.ok).toBe(true)
  })
})

describe('projectLinesAfterReceipt', () => {
  it('adds to the existing received count rather than replacing it', () => {
    const projected = projectLinesAfterReceipt(
      [line('a', 10, 2), line('b', 5)],
      new Map([['a', 3]])
    )
    expect(projected.find((l) => l.id === 'a')?.quantityReceived).toBe(5)
    expect(projected.find((l) => l.id === 'b')?.quantityReceived).toBe(0)
  })

  it('leaves the input untouched', () => {
    const lines = [line('a', 10, 2)]
    projectLinesAfterReceipt(lines, new Map([['a', 3]]))
    expect(lines[0].quantityReceived).toBe(2)
  })

  it('composes with the status derivation to close an order', () => {
    const lines = [line('a', 10, 2), line('b', 5)]
    const projected = projectLinesAfterReceipt(lines, new Map([['a', 8], ['b', 5]]))
    expect(derivePurchaseOrderStatus('PARTIALLY_RECEIVED', projected)).toBe('RECEIVED')
  })
})

describe('purchaseOrderSubtotalCents', () => {
  it('totals lines in cents', () => {
    expect(
      purchaseOrderSubtotalCents([
        { quantityOrdered: 10, unitCost: 4.25 },
        { quantityOrdered: 3, unitCost: 1.1 },
      ])
    ).toBe(4250 + 330)
  })

  it('rounds each unit cost to cents before multiplying', () => {
    // Multiplying a float first and rounding after drifts on large quantities.
    expect(purchaseOrderSubtotalCents([{ quantityOrdered: 300, unitCost: 0.07 }])).toBe(2100)
  })

  it('is zero for no lines', () => {
    expect(purchaseOrderSubtotalCents([])).toBe(0)
  })
})

describe('generatePoNumber', () => {
  it('encodes the date and is prefixed so it cannot be mistaken for an order number', () => {
    const po = generatePoNumber(new Date('2026-08-08T12:00:00.000Z'))
    expect(po).toMatch(/^PO-20260808-\d{4}$/)
  })
})
