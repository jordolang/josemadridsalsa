import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted so the vi.mock factories below (which are themselves hoisted) can see them.
const { prismaMock, quickBooksFetch } = vi.hoisted(() => ({
  prismaMock: {
    quickBooksSettings: { findUnique: vi.fn() },
    quickBooksEntityMap: { findUnique: vi.fn(), upsert: vi.fn() },
    quickBooksSyncRecord: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
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

import {
  backoffFor,
  customerLocalId,
  drainQueue,
  ensureCustomer,
  escapeQueryLiteral,
  findExistingReceipt,
  syncOrder,
} from '@/lib/quickbooks/sync'

const order = {
  id: 'ord_1',
  orderNumber: 'JMS-1001',
  createdAt: new Date(2026, 6, 22),
  subtotal: 24,
  shippingCost: 0,
  tax: 0,
  discountAmount: 0,
  giftCertificateAmount: 0,
  total: 24,
  customerEmail: 'buyer@example.com',
  customerFirstName: 'Ada',
  customerLastName: 'Lovelace',
  userId: null,
  items: [
    {
      productId: 'prod_1',
      productName: 'Black Bean & Corn',
      productSku: 'JMS-BBC',
      quantity: 2,
      unitPrice: 12,
      totalPrice: 24,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.quickBooksEntityMap.findUnique.mockResolvedValue(null)
  prismaMock.quickBooksEntityMap.upsert.mockResolvedValue({})
  prismaMock.quickBooksSyncRecord.update.mockResolvedValue({})
})

describe('backoffFor', () => {
  it('backs off exponentially', () => {
    const first = backoffFor(1).getTime() - Date.now()
    const second = backoffFor(2).getTime() - Date.now()
    expect(second).toBeGreaterThan(first)
  })

  it('caps the delay at six hours', () => {
    const delay = backoffFor(50).getTime() - Date.now()
    expect(delay).toBeLessThanOrEqual(6 * 60 * 60 * 1000 + 1000)
  })
})

describe('escapeQueryLiteral', () => {
  it("escapes an apostrophe so a name like Jose's cannot break the query", () => {
    expect(escapeQueryLiteral("Jose's Original")).toBe("Jose\\'s Original")
  })

  it('escapes backslashes', () => {
    expect(escapeQueryLiteral('a\\b')).toBe('a\\\\b')
  })

  it('leaves ordinary text alone', () => {
    expect(escapeQueryLiteral('Roasted Garlic')).toBe('Roasted Garlic')
  })
})

describe('customerLocalId', () => {
  it('prefers the user id for registered buyers', () => {
    expect(customerLocalId({ userId: 'usr_9', customerEmail: 'a@b.com' })).toBe('usr_9')
  })

  it('keys guests on a normalised email so repeat guests reuse one customer', () => {
    expect(customerLocalId({ userId: null, customerEmail: '  Buyer@Example.COM ' })).toBe(
      'guest:buyer@example.com'
    )
  })

  it('returns null when there is nothing to identify the buyer by', () => {
    expect(customerLocalId({ userId: null, customerEmail: null })).toBeNull()
  })
})

describe('ensureCustomer', () => {
  it('uses an existing mapping without calling QuickBooks', async () => {
    prismaMock.quickBooksEntityMap.findUnique.mockResolvedValue({ quickbooksId: '42' })

    const id = await ensureCustomer('realm-1', order)

    expect(id).toBe('42')
    expect(quickBooksFetch).not.toHaveBeenCalled()
  })

  it('adopts a customer that already exists in QBO instead of duplicating them', async () => {
    quickBooksFetch.mockResolvedValueOnce({ QueryResponse: { Customer: [{ Id: '77', SyncToken: '0' }] } })

    const id = await ensureCustomer('realm-1', order)

    expect(id).toBe('77')
    // Query only — no create call.
    expect(quickBooksFetch).toHaveBeenCalledTimes(1)
    expect(prismaMock.quickBooksEntityMap.upsert).toHaveBeenCalled()
  })

  it('creates a customer when QBO has no match', async () => {
    quickBooksFetch
      .mockResolvedValueOnce({ QueryResponse: {} })
      .mockResolvedValueOnce({ Customer: { Id: '90', SyncToken: '0' } })

    const id = await ensureCustomer('realm-1', order)

    expect(id).toBe('90')
    expect(quickBooksFetch).toHaveBeenLastCalledWith('customer', expect.objectContaining({ method: 'POST' }))
  })
})

describe('findExistingReceipt', () => {
  it('returns the id of an already-posted receipt', async () => {
    quickBooksFetch.mockResolvedValueOnce({ QueryResponse: { SalesReceipt: [{ Id: '500' }] } })
    expect(await findExistingReceipt('JMS-1001')).toBe('500')
  })

  it('returns null when nothing is posted yet', async () => {
    quickBooksFetch.mockResolvedValueOnce({ QueryResponse: {} })
    expect(await findExistingReceipt('JMS-1001')).toBeNull()
  })
})

describe('syncOrder', () => {
  const settings = {
    incomeAccountId: '79',
    depositAccountId: '4',
    shippingItemId: '21',
    discountAccountId: '86',
    giftCertificateAccountId: null,
    syncStartDate: null,
  }

  function mockOrderRow() {
    prismaMock.order.findUnique.mockResolvedValue({
      ...order,
      guestEmail: order.customerEmail,
      user: null,
      items: order.items.map((i) => ({ ...i })),
    })
  }

  it('blocks when no income account is mapped', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue({ ...settings, incomeAccountId: null })

    const result = await syncOrder('ord_1')

    expect(result.status).toBe('BLOCKED')
    expect(quickBooksFetch).not.toHaveBeenCalled()
  })

  it('does not post a second receipt when one already exists', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue(settings)
    mockOrderRow()
    quickBooksFetch.mockResolvedValueOnce({ QueryResponse: { SalesReceipt: [{ Id: '500' }] } })

    const result = await syncOrder('ord_1')

    expect(result).toEqual({ status: 'SYNCED', quickbooksId: '500' })
    // The duplicate check was the only call — nothing was created.
    expect(quickBooksFetch).toHaveBeenCalledTimes(1)
  })

  it('blocks an order that predates the sync start date', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue({
      ...settings,
      syncStartDate: new Date(2026, 11, 1),
    })
    mockOrderRow()

    const result = await syncOrder('ord_1')

    expect(result.status).toBe('BLOCKED')
    if (result.status !== 'BLOCKED') return
    expect(result.reason).toContain('predates')
  })

  it('posts a receipt for a clean order', async () => {
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue(settings)
    mockOrderRow()
    quickBooksFetch
      .mockResolvedValueOnce({ QueryResponse: {} }) // duplicate check
      .mockResolvedValueOnce({ QueryResponse: { Customer: [{ Id: '77' }] } }) // customer
      .mockResolvedValueOnce({ QueryResponse: { Item: [{ Id: '101' }] } }) // item by sku
      .mockResolvedValueOnce({ SalesReceipt: { Id: '900' } })

    const result = await syncOrder('ord_1')

    expect(result).toMatchObject({ status: 'SYNCED', quickbooksId: '900' })
    // The sent payload comes back so the ledger can retain it for diagnostics.
    if (result.status !== 'SYNCED') return
    expect(result.payload).toMatchObject({ DocNumber: 'JMS-1001' })
    expect(quickBooksFetch).toHaveBeenLastCalledWith(
      'salesreceipt',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('drainQueue', () => {
  it('parks a blocked record without scheduling a retry', async () => {
    prismaMock.quickBooksSyncRecord.findMany.mockResolvedValue([
      { id: 'rec_1', entityId: 'ord_1', attempts: 0 },
    ])
    prismaMock.quickBooksSettings.findUnique.mockResolvedValue({ incomeAccountId: null })

    const tally = await drainQueue()

    expect(tally.blocked).toBe(1)
    const finalUpdate = prismaMock.quickBooksSyncRecord.update.mock.calls.at(-1)![0]
    expect(finalUpdate.data.status).toBe('BLOCKED')
    expect(finalUpdate.data.nextAttemptAt).toBeNull()
  })

  it('schedules a retry for a transient failure', async () => {
    prismaMock.quickBooksSyncRecord.findMany.mockResolvedValue([
      { id: 'rec_2', entityId: 'ord_1', attempts: 0 },
    ])
    prismaMock.quickBooksSettings.findUnique.mockRejectedValue(new Error('connection reset'))

    const tally = await drainQueue()

    expect(tally.failed).toBe(1)
    const finalUpdate = prismaMock.quickBooksSyncRecord.update.mock.calls.at(-1)![0]
    expect(finalUpdate.data.status).toBe('FAILED')
    expect(finalUpdate.data.lastError).toContain('connection reset')
    expect(finalUpdate.data.nextAttemptAt).toBeInstanceOf(Date)
  })

  it('stops rescheduling once the attempt limit is reached', async () => {
    prismaMock.quickBooksSyncRecord.findMany.mockResolvedValue([
      { id: 'rec_3', entityId: 'ord_1', attempts: 4 },
    ])
    prismaMock.quickBooksSettings.findUnique.mockRejectedValue(new Error('still down'))

    await drainQueue()

    const finalUpdate = prismaMock.quickBooksSyncRecord.update.mock.calls.at(-1)![0]
    expect(finalUpdate.data.nextAttemptAt).toBeNull()
  })
})

describe('QuickBooks API error handling', () => {
  it('extracts the fault message and intuit_tid from a validation error', async () => {
    const { QuickBooksApiError } = await import('@/lib/quickbooks/client')
    const actual = await vi.importActual<typeof import('@/lib/quickbooks/client')>(
      '@/lib/quickbooks/client'
    )

    const fault = {
      Fault: {
        Error: [
          {
            Message: 'Invalid Reference Id',
            Detail: 'Invalid Reference Id : Item with Id 999 was not found.',
            code: '610',
          },
        ],
        type: 'ValidationFault',
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(fault), {
          status: 400,
          headers: { 'intuit_tid': '1-abc-def', 'content-type': 'application/json' },
        })
      )
    )

    await expect(actual.quickBooksFetch('salesreceipt', { method: 'POST', body: {} })).rejects.toThrow(
      /Invalid Reference Id/
    )

    try {
      await actual.quickBooksFetch('salesreceipt', { method: 'POST', body: {} })
    } catch (error) {
      const err = error as InstanceType<typeof QuickBooksApiError>
      expect(err.status).toBe(400)
      expect(err.intuitTid).toBe('1-abc-def')
      expect(err.message).toContain('Item with Id 999 was not found')
    }

    vi.unstubAllGlobals()
  })
})
