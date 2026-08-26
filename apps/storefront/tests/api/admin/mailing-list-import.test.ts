import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression guard for the import that dies part-way through a large list.
 *
 * A mailing list built from the customer database is tens of thousands of
 * contacts. The importer upserted them one at a time — one database round trip
 * per contact — which ran past the function's time limit and left the list half
 * imported. Rows now go in a batch at a time inside a single `$transaction`.
 *
 * The mock counts round trips, because that is the thing that broke: a version
 * that produces the same rows one call at a time still fails in production.
 */

const upsert = vi.fn(async () => ({}))
const transaction = vi.fn(async (ops: unknown[]) => ops)

vi.mock('@/lib/prisma', () => {
  const client = {
    mailingList: { findUnique: vi.fn(async () => ({ id: 'list-1', name: 'Imported' })) },
    mailingListSubscriber: { upsert },
    $transaction: transaction,
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'admin@example.com' })),
  hasPermission: vi.fn(async () => true),
}))
vi.mock('@/lib/audit', () => ({ logAuditWithRequest: vi.fn(async () => undefined) }))

const { POST } = await import('@/app/api/admin/mailing-lists/[id]/import/route')

const params = Promise.resolve({ id: 'list-1' })

// The route only reads `formData()` off the request. Building a real Request
// round-trips the file through the fetch body encoder, which loses jsdom's File
// contents, so hand it the form directly.
function importRequest(csv: string) {
  const form = new FormData()
  form.append('file', new File([csv], 'contacts.csv', { type: 'text/csv' }))
  form.append('mapping', JSON.stringify({ email: 'Email address' }))
  return { formData: async () => form } as unknown as Parameters<typeof POST>[0]
}

function csvOf(rows: string[]) {
  return ['Email address,First name', ...rows.map((r) => `${r},Test`)].join('\n')
}

beforeEach(() => {
  upsert.mockClear()
  transaction.mockClear()
})

describe('mailing list CSV import', () => {
  it('batches rows instead of one round trip per contact', async () => {
    const emails = Array.from({ length: 1200 }, (_, i) => `contact${i}@example.com`)

    const res = await POST(importRequest(csvOf(emails)), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.result.imported).toBe(1200)

    // 1200 rows at a batch size of 500 is three transactions. The bug was 1200
    // awaited upserts; anything near that count is the regression coming back.
    expect(transaction).toHaveBeenCalledTimes(3)
    expect(upsert).toHaveBeenCalledTimes(1200)
    expect(transaction.mock.calls.map(([ops]) => (ops as unknown[]).length)).toEqual([500, 500, 200])
  })

  it('caps the error report so a mis-mapped column cannot return megabytes', async () => {
    // Every row is unparseable as an email, so every row is rejected.
    const rows = Array.from({ length: 500 }, (_, i) => `not-an-email-${i}`)

    const res = await POST(importRequest(csvOf(rows)), { params })
    const body = await res.json()

    expect(body.result.skipped).toBe(500)
    expect(body.result.errors).toHaveLength(100)
  })
})
