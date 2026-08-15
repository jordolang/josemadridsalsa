import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted so the vi.mock factories below (which are themselves hoisted) can see them.
const { prismaMock, quickBooksFetch } = vi.hoisted(() => ({
  prismaMock: {
    quickBooksSettings: { findUnique: vi.fn() },
    quickBooksEntityMap: { findUnique: vi.fn(), upsert: vi.fn() },
    quickBooksSyncRecord: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
    ledgerEntry: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), findMany: vi.fn() },
  },
  quickBooksFetch: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }))

vi.mock('@/lib/quickbooks/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/quickbooks/client')>(
    '@/lib/quickbooks/client'
  )
  return { quickBooksFetch, QuickBooksApiError: actual.QuickBooksApiError }
})

vi.mock('@/lib/quickbooks/connection', () => ({
  getValidAccessToken: vi.fn(async () => ({
    accessToken: 'tok',
    realmId: 'realm-1',
    environment: 'sandbox' as const,
  })),
  markSynced: vi.fn(async () => {}),
}))

import { enqueueLedgerEntries, syncLedgerEntry } from '@/lib/quickbooks/sync'
import { JOURNAL_SYNC_SOURCES } from '@/lib/quickbooks/journal'

const ledgerRow = {
  id: 'clx9a8b7c6d5e4f3g2h1i0jkl',
  date: new Date('2019-07-01T00:00:00.000Z'),
  amountCents: 24500,
  category: 'SHOW_SALES' as const,
  source: 'SHOW_ARCHIVE' as const,
  description: 'Zanesville Festival — show sales',
  counterparty: 'Mike',
  memo: null,
}

/** A settings row with the ledger accounts mapped. */
const mappedSettings = {
  realmId: 'realm-1',
  autoSyncEnabled: true,
  syncStartDate: null,
  ledgerAccountMap: {
    SHOW_SALES: { accountId: '41', offsetId: '4' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.quickBooksSettings.findUnique.mockResolvedValue(mappedSettings)
  prismaMock.ledgerEntry.findUnique.mockResolvedValue(ledgerRow)
  prismaMock.ledgerEntry.update.mockResolvedValue({})
  prismaMock.quickBooksEntityMap.upsert.mockResolvedValue({})
})

describe('syncLedgerEntry', () => {
  it('posts a balanced journal entry and records the mapping', async () => {
    quickBooksFetch
      // The duplicate-guard query finds nothing.
      .mockResolvedValueOnce({ QueryResponse: {} })
      .mockResolvedValueOnce({ JournalEntry: { Id: 'qb-500' } })

    const result = await syncLedgerEntry(ledgerRow.id)

    expect(result).toMatchObject({ status: 'SYNCED', quickbooksId: 'qb-500' })
    const [path, options] = quickBooksFetch.mock.calls[1]
    expect(path).toBe('journalentry')
    expect(options.body.Line).toHaveLength(2)
    expect(options.body.Line[0].JournalEntryLineDetail.PostingType).toBe('Debit')
    expect(options.body.Line[1].JournalEntryLineDetail.PostingType).toBe('Credit')
  })

  it('stamps exportedAt, so the ledger’s "not yet sent" filter stays honest', async () => {
    quickBooksFetch
      .mockResolvedValueOnce({ QueryResponse: {} })
      .mockResolvedValueOnce({ JournalEntry: { Id: 'qb-500' } })

    await syncLedgerEntry(ledgerRow.id)

    expect(prismaMock.ledgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ledgerRow.id } })
    )
  })

  it('adopts an entry already in QuickBooks instead of posting the money twice', async () => {
    // The failure this guards: created in QuickBooks, then a crash before our record of it was
    // written. On retry the duplicate guard finds it by document number.
    quickBooksFetch.mockResolvedValueOnce({ QueryResponse: { JournalEntry: [{ Id: 'qb-existing' }] } })

    const result = await syncLedgerEntry(ledgerRow.id)

    expect(result).toMatchObject({ status: 'SYNCED', quickbooksId: 'qb-existing' })
    // One call only: the query. Nothing was posted.
    expect(quickBooksFetch).toHaveBeenCalledTimes(1)
    expect(prismaMock.quickBooksEntityMap.upsert).toHaveBeenCalled()
  })

  it('blocks an order-derived row rather than booking the sale twice', async () => {
    prismaMock.ledgerEntry.findUnique.mockResolvedValue({ ...ledgerRow, source: 'ORDER' })

    const result = await syncLedgerEntry(ledgerRow.id)

    expect(result.status).toBe('BLOCKED')
    expect(quickBooksFetch).not.toHaveBeenCalled()
  })

  it('blocks when the category has no mapped account', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue({
      ...mappedSettings,
      ledgerAccountMap: {},
    })

    const result = await syncLedgerEntry(ledgerRow.id)

    expect(result.status).toBe('BLOCKED')
    expect(quickBooksFetch).not.toHaveBeenCalled()
  })

  it('blocks a row that predates the sync start date', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue({
      ...mappedSettings,
      syncStartDate: new Date('2026-01-01T00:00:00.000Z'),
    })

    const result = await syncLedgerEntry(ledgerRow.id)

    expect(result.status).toBe('BLOCKED')
    expect(quickBooksFetch).not.toHaveBeenCalled()
  })
})

describe('enqueueLedgerEntries', () => {
  it('only ever asks for sources that are not already in the books as receipts', async () => {
    prismaMock.quickBooksSyncRecord.findMany.mockResolvedValue([])
    prismaMock.ledgerEntry.findMany.mockResolvedValue([])

    await enqueueLedgerEntries()

    const where = prismaMock.ledgerEntry.findMany.mock.calls[0][0].where
    expect(where.source.in).toEqual([...JOURNAL_SYNC_SOURCES])
    expect(where.source.in).not.toContain('ORDER')
    expect(where.source.in).not.toContain('REFUND')
  })

  it('excludes queued rows in the query, so a full first page cannot stall the sweep', async () => {
    // The bug this pins: take the oldest N, then filter out the already-queued ones, and once N
    // rows are queued every sweep re-reads the same page, finds nothing new, and never reaches
    // row N+1.
    prismaMock.quickBooksSyncRecord.findMany.mockResolvedValue([{ entityId: 'a' }, { entityId: 'b' }])
    prismaMock.ledgerEntry.findMany.mockResolvedValue([])

    await enqueueLedgerEntries(2)

    const where = prismaMock.ledgerEntry.findMany.mock.calls[0][0].where
    expect(where.id).toEqual({ notIn: ['a', 'b'] })
  })

  it('does nothing while automatic sync is switched off', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue({
      ...mappedSettings,
      autoSyncEnabled: false,
    })

    expect(await enqueueLedgerEntries()).toBe(0)
    expect(prismaMock.ledgerEntry.findMany).not.toHaveBeenCalled()
  })

  it('queues what the query returned as journal entries', async () => {
    prismaMock.quickBooksSyncRecord.findMany.mockResolvedValue([{ entityId: 'a' }])
    prismaMock.ledgerEntry.findMany.mockResolvedValue([{ id: 'b' }])
    prismaMock.quickBooksSyncRecord.createMany.mockResolvedValue({ count: 1 })

    expect(await enqueueLedgerEntries()).toBe(1)
    expect(prismaMock.quickBooksSyncRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ entityType: 'JOURNAL_ENTRY', entityId: 'b' }],
      })
    )
  })

  it('honours the sync start date so connecting does not import a decade of history', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue({
      ...mappedSettings,
      syncStartDate: new Date('2026-01-01T00:00:00.000Z'),
    })
    prismaMock.quickBooksSyncRecord.findMany.mockResolvedValue([])
    prismaMock.ledgerEntry.findMany.mockResolvedValue([])

    await enqueueLedgerEntries()

    const where = prismaMock.ledgerEntry.findMany.mock.calls[0][0].where
    expect(where.date).toEqual({ gte: new Date('2026-01-01T00:00:00.000Z') })
  })
})
