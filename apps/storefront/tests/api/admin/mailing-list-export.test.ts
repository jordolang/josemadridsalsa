import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression guard for the subscriber CSV export.
 *
 * A list built from the customer database is tens of thousands of contacts. The
 * export loaded all of them with every column — `customFields` included, though
 * no output column reads it — and joined one CSV string in memory, holding
 * several megabytes twice over inside a function that then had to return it.
 * That is the shape that made the list page unopenable.
 *
 * So the assertions are about the shape of the read and the body: the query
 * must be paged and narrow, and the CSV must arrive as a stream that still
 * carries exactly one header and every row.
 */

const BATCH = 1000

const listFindUnique = vi.fn(async () => ({ name: 'Customers' }))
const subscriberFindMany = vi.fn(async () => [] as unknown[])

vi.mock('@/lib/prisma', () => {
  const client = {
    mailingList: { findUnique: listFindUnique },
    mailingListSubscriber: { findMany: subscriberFindMany },
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'admin@example.com' })),
  hasPermission: vi.fn(async () => true),
}))

const route = await import('@/app/api/admin/mailing-lists/[id]/export/route')
const { GET } = route

/** Subscribers as the narrowed `select` returns them. */
function page(start: number, size: number) {
  return Array.from({ length: size }, (_, i) => ({
    email: `contact${String(start + i).padStart(6, '0')}@example.com`,
    firstName: 'Test',
    lastName: `User${start + i}`,
    phone: null,
    status: 'SUBSCRIBED',
    source: 'import',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    unsubscribedAt: null,
    tags: ['customer', 'ohio'],
  }))
}

type Query = {
  take?: number
  skip?: number
  cursor?: unknown
  select?: Record<string, unknown>
  include?: unknown
}

function exportRequest() {
  return {} as unknown as Parameters<typeof GET>[0]
}

const params = { params: Promise.resolve({ id: 'list-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  listFindUnique.mockResolvedValue({ name: 'Customers' })
})

describe('mailing list CSV export', () => {
  it('reads the subscribers in bounded pages', async () => {
    subscriberFindMany
      .mockResolvedValueOnce(page(0, BATCH))
      .mockResolvedValueOnce(page(BATCH, 200))

    const res = await GET(exportRequest(), params)
    await res.text()

    // The list row must not drag its subscribers along.
    const listQuery = listFindUnique.mock.calls[0][0] as Query
    expect(listQuery.include).toBeUndefined()

    expect(subscriberFindMany).toHaveBeenCalledTimes(2)
    const first = subscriberFindMany.mock.calls[0][0] as Query
    expect(first.take).toBeGreaterThan(0)
    expect(first.take).toBeLessThanOrEqual(BATCH)
    expect(first.cursor).toBeUndefined()

    const second = subscriberFindMany.mock.calls[1][0] as Query
    expect(second.skip).toBe(1)
    expect(second.cursor).toEqual({
      listId_email: { listId: 'list-1', email: page(0, BATCH)[BATCH - 1].email },
    })
  })

  it('never selects the customFields blob', async () => {
    subscriberFindMany.mockResolvedValueOnce(page(0, 3))

    const res = await GET(exportRequest(), params)
    await res.text()

    const select = (subscriberFindMany.mock.calls[0][0] as Query).select
    expect(select).toBeDefined()
    // No output column reads it, and it is the widest column on the row.
    expect(select).not.toHaveProperty('customFields')
    expect(select!.email).toBe(true)
  })

  it('streams one header and every row across the pages', async () => {
    subscriberFindMany
      .mockResolvedValueOnce(page(0, BATCH))
      .mockResolvedValueOnce(page(BATCH, 200))

    const res = await GET(exportRequest(), params)
    const csv = await res.text()
    const lines = csv.trim().split('\r\n')

    expect(lines[0]).toBe(
      'Email,First Name,Last Name,Phone,Status,Source,Subscribed At,Unsubscribed At,Tags'
    )
    // A header per page would be the giveaway that the chunks were pasted
    // together rather than written as one document.
    expect(lines.filter((l) => l.startsWith('Email,'))).toHaveLength(1)
    expect(lines).toHaveLength(1 + BATCH + 200)
    expect(lines[1]).toBe(
      'contact000000@example.com,Test,User0,,SUBSCRIBED,import,2026-01-02T03:04:05.000Z,,"customer, ohio"'
    )
  })

  it('sends a header-only file for an empty list', async () => {
    subscriberFindMany.mockResolvedValueOnce([])

    const res = await GET(exportRequest(), params)

    expect(await res.text()).toBe(
      'Email,First Name,Last Name,Phone,Status,Source,Subscribed At,Unsubscribed At,Tags'
    )
    expect(res.headers.get('Content-Type')).toContain('text/csv')
  })

  it('gives itself room to finish a long export', async () => {
    // Without this the export shares the platform default, which a 22k-row list
    // outruns.
    expect(route.maxDuration).toBeGreaterThanOrEqual(60)
  })

  it('404s a missing list before opening a stream', async () => {
    listFindUnique.mockResolvedValueOnce(null as unknown as { name: string })

    const res = await GET(exportRequest(), params)

    expect(res.status).toBe(404)
    expect(subscriberFindMany).not.toHaveBeenCalled()
  })
})
