import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  captureUpdate: vi.fn(),
  lineUpdate: vi.fn(),
  ledgerUpsert: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const client = {
    formCapture: { findUnique: mocks.findUnique, update: mocks.captureUpdate },
    formCaptureLine: { update: mocks.lineUpdate },
    ledgerEntry: { upsert: mocks.ledgerUpsert },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        formCapture: { update: mocks.captureUpdate },
        formCaptureLine: { update: mocks.lineUpdate },
        ledgerEntry: { upsert: mocks.ledgerUpsert },
      })
    ),
  }
  return { prisma: client, default: client }
})

import {
  buildDescription,
  isPostable,
  ledgerDedupeKey,
  postCaptureToLedger,
} from '@/lib/form-capture/post'

function captureFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap_1',
    formType: 'SHOW_SETTLEMENT',
    status: 'APPROVED',
    capturedOn: new Date('2026-04-13T00:00:00.000Z'),
    uploadedAt: new Date('2026-04-20T00:00:00.000Z'),
    uploadedById: 'user_up',
    reviewedById: 'user_rev',
    rawExtraction: { subject: 'Akron Home Show' },
    lines: [
      {
        id: 'line_cash',
        lineNumber: 1,
        label: 'Cash',
        direction: 'INCOME',
        category: 'SHOW_SALES',
        amountCents: 30_000,
        excluded: false,
        ledgerEntryId: null,
      },
      {
        id: 'line_fee',
        lineNumber: 2,
        label: 'Booth fee',
        direction: 'EXPENSE',
        category: 'BOOTH_FEE',
        amountCents: 7_500,
        excluded: false,
        ledgerEntryId: null,
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.ledgerUpsert.mockImplementation(async ({ where }: { where: { dedupeKey: string } }) => ({
    id: `ledger_${where.dedupeKey}`,
  }))
})

describe('ledgerDedupeKey', () => {
  it('derives a stable key from the line id', () => {
    expect(ledgerDedupeKey('line_cash')).toBe('capture:line_cash')
  })
})

describe('isPostable', () => {
  it('posts an ordinary money line', () => {
    expect(isPostable({ excluded: false, amountCents: 100 })).toBe(true)
  })

  it('never posts an excluded line', () => {
    expect(isPostable({ excluded: true, amountCents: 100 })).toBe(false)
  })

  it('never posts a quantity-only line, which carries no dollars', () => {
    expect(isPostable({ excluded: false, amountCents: 0 })).toBe(false)
  })
})

describe('buildDescription', () => {
  it('leads with the subject when the form named one', () => {
    expect(
      buildDescription({ formType: 'SHOW_SETTLEMENT' }, { label: 'Cash' }, 'Akron Home Show')
    ).toBe('Akron Home Show — Cash')
  })

  it('falls back to a readable form name when there is no subject', () => {
    expect(buildDescription({ formType: 'SHOW_SETTLEMENT' }, { label: 'Cash' }, null)).toBe(
      'show settlement — Cash'
    )
  })
})

describe('postCaptureToLedger', () => {
  it('writes one ledger row per money line and marks the capture posted', async () => {
    mocks.findUnique.mockResolvedValue(captureFixture())

    const result = await postCaptureToLedger('cap_1')

    expect(result.postedLineIds).toEqual(['line_cash', 'line_fee'])
    expect(mocks.ledgerUpsert).toHaveBeenCalledTimes(2)
    expect(mocks.captureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED' }) })
    )
  })

  it('dates the ledger row from the form, not from the upload', async () => {
    // The accounting date has to be the day the money moved. Forms are routinely photographed
    // days or weeks later, which is the entire reason the past data drifted.
    mocks.findUnique.mockResolvedValue(captureFixture())

    await postCaptureToLedger('cap_1')

    expect(mocks.ledgerUpsert.mock.calls[0][0].create.date).toEqual(
      new Date('2026-04-13T00:00:00.000Z')
    )
  })

  it('falls back to the upload date only when the form carried none', async () => {
    mocks.findUnique.mockResolvedValue(captureFixture({ capturedOn: null }))

    await postCaptureToLedger('cap_1')

    expect(mocks.ledgerUpsert.mock.calls[0][0].create.date).toEqual(
      new Date('2026-04-20T00:00:00.000Z')
    )
  })

  it('keys every row for idempotency and tags the source as the capture', async () => {
    mocks.findUnique.mockResolvedValue(captureFixture())

    await postCaptureToLedger('cap_1')

    const created = mocks.ledgerUpsert.mock.calls[0][0].create
    expect(created.dedupeKey).toBe('capture:line_cash')
    expect(created.source).toBe('FORM_CAPTURE')
    expect(created.sourceId).toBe('cap_1')
    expect(created.channel).toBe('EVENT')
  })

  it('does nothing the second time a posted capture is submitted', async () => {
    // Idempotency is the whole point: a double-tap on the approve button must not double the books.
    mocks.findUnique.mockResolvedValue(
      captureFixture({
        status: 'POSTED',
        lines: [{ ...captureFixture().lines[0], ledgerEntryId: 'ledger_existing' }],
      })
    )

    const result = await postCaptureToLedger('cap_1')

    expect(result.postedLineIds).toEqual([])
    expect(result.ledgerEntryIds).toEqual(['ledger_existing'])
    expect(mocks.ledgerUpsert).not.toHaveBeenCalled()
  })

  it('skips a line that already produced a ledger row', async () => {
    mocks.findUnique.mockResolvedValue(
      captureFixture({
        lines: [
          { ...captureFixture().lines[0], ledgerEntryId: 'ledger_existing' },
          captureFixture().lines[1],
        ],
      })
    )

    const result = await postCaptureToLedger('cap_1')

    expect(result.postedLineIds).toEqual(['line_fee'])
    expect(result.skippedLineIds).toEqual(['line_cash'])
    expect(mocks.ledgerUpsert).toHaveBeenCalledTimes(1)
  })

  it('skips excluded and quantity-only lines', async () => {
    mocks.findUnique.mockResolvedValue(
      captureFixture({
        lines: [
          { ...captureFixture().lines[0], excluded: true },
          { ...captureFixture().lines[1], amountCents: 0 },
        ],
      })
    )

    const result = await postCaptureToLedger('cap_1')

    expect(result.postedLineIds).toEqual([])
    expect(mocks.ledgerUpsert).not.toHaveBeenCalled()
  })

  it('refuses to post a capture that has not been approved', async () => {
    mocks.findUnique.mockResolvedValue(captureFixture({ status: 'NEEDS_REVIEW' }))

    await expect(postCaptureToLedger('cap_1')).rejects.toThrow(/only an APPROVED capture can post/)
    expect(mocks.ledgerUpsert).not.toHaveBeenCalled()
  })

  it('throws when the capture does not exist', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await expect(postCaptureToLedger('missing')).rejects.toThrow(/not found/)
  })
})
