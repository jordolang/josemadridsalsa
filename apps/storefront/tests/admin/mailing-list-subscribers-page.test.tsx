import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression guard for the mailing list page that could not be opened.
 *
 * A list built from the customer database holds tens of thousands of
 * contacts. The page loaded all of them with every column, which put the whole
 * list in the RSC payload — and, because each server action here calls
 * `revalidatePath`, in the response of every action on the page too. Past a few
 * megabytes the function returned an error page instead of an RSC payload, and
 * the admin error boundary reported "An unexpected response was received from
 * the server."
 *
 * So the assertions are about the shape of the query, not the markup: the read
 * must be bounded, and it must not select `customFields`, where the importer
 * parks every unmapped column of the source CSV.
 */

const findMany = vi.fn(async () => [])
const count = vi.fn(async () => 22_000)

vi.mock('@/lib/prisma', () => {
  const client = {
    mailingList: {
      findUnique: vi.fn(async () => ({ id: 'list-1', name: 'Customers', description: null })),
    },
    mailingListSubscriber: { findMany, count },
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'admin@example.com' })),
  hasPermission: vi.fn(async () => true),
}))

const ListSubscribersPage = (
  await import('@/app/admin/communications/lists/[id]/page')
).default

function render(searchParams: { page?: string } = {}) {
  return ListSubscribersPage({
    params: Promise.resolve({ id: 'list-1' }),
    searchParams: Promise.resolve(searchParams),
  })
}

beforeEach(() => {
  findMany.mockClear()
  count.mockClear()
})

describe('mailing list subscribers page', () => {
  it('reads one bounded page instead of the whole list', async () => {
    await render()

    expect(findMany).toHaveBeenCalledTimes(1)
    const query = findMany.mock.calls[0][0] as {
      take?: number
      skip?: number
      select?: Record<string, boolean>
    }

    expect(query.take).toBeGreaterThan(0)
    expect(query.take).toBeLessThanOrEqual(500)
    expect(query.skip).toBe(0)

    // A `select` is what keeps `customFields` out of the payload; without one
    // Prisma returns every column.
    expect(query.select).toBeDefined()
    expect(query.select).not.toHaveProperty('customFields')
  })

  it('offsets by whole pages and keeps the order stable across them', async () => {
    await render({ page: '3' })

    const query = findMany.mock.calls[0][0] as {
      take: number
      skip: number
      orderBy: unknown[]
    }

    expect(query.skip).toBe(query.take * 2)
    // A CSV import stamps thousands of rows with the same `createdAt`, so a
    // single sort key lets rows shuffle between pages.
    expect(query.orderBy).toHaveLength(2)
  })

  it('falls back to the first page for a junk page parameter', async () => {
    await render({ page: '-4' })

    expect((findMany.mock.calls[0][0] as { skip: number }).skip).toBe(0)
  })
})
