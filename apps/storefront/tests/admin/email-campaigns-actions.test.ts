import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression guard for creating a campaign against a large mailing list.
 *
 * A list built from the customer database is tens of thousands of contacts.
 * `createCampaign` loaded every one of them — with every column, `customFields`
 * included — into a `recipientsList` array and then into a single nested
 * `create`. That is the same shape that made the list page unopenable, run
 * inside a server action, so the assertions are about the shape of the queries
 * rather than the returned markup: the read must be paged, it must not fetch
 * `customFields` unless a mapping reads it, and the write must not be one
 * statement carrying the whole list.
 */

const BATCH = 1000

const listFindUnique = vi.fn(async () => ({ id: 'list-1' }))
const subscriberFindMany = vi.fn(async () => [] as unknown[])
const subscriberCount = vi.fn(async () => 0)
const templateFindUnique = vi.fn(async () => ({ id: 'template-1' }))
const campaignCreate = vi.fn(async () => ({ id: 'campaign-1' }))
const campaignUpdate = vi.fn(async () => ({}))
const campaignDelete = vi.fn(async () => ({}))
const recipientCreateMany = vi.fn(async ({ data }: { data: unknown[] }) => ({
  count: data.length,
}))
const recipientCount = vi.fn(async () => 0)
const recipientUpdateMany = vi.fn(async () => ({ count: 0 }))
const campaignFindUnique = vi.fn(async () => ({
  id: 'campaign-1',
  status: 'DRAFT',
  totalRecipients: 0,
  startedAt: null,
}))

vi.mock('@/lib/prisma', () => {
  const client = {
    mailingList: { findUnique: listFindUnique },
    mailingListSubscriber: { findMany: subscriberFindMany, count: subscriberCount },
    emailTemplate: { findUnique: templateFindUnique },
    emailCampaign: {
      findUnique: campaignFindUnique,
      create: campaignCreate,
      update: campaignUpdate,
      delete: campaignDelete,
    },
    emailRecipient: {
      createMany: recipientCreateMany,
      count: recipientCount,
      updateMany: recipientUpdateMany,
    },
    discountCode: { findMany: vi.fn(async () => []) },
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'admin@example.com' })),
  hasAnyPermission: vi.fn(async () => true),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email/sender', () => ({
  parseCSV: vi.fn(() => ({ recipients: [], errors: [] })),
  parseTextList: vi.fn(() => ({ recipients: [], errors: [] })),
}))
vi.mock('@/lib/email/queue', () => ({
  triggerCampaignContinuation: vi.fn(async () => undefined),
}))

const { createCampaign, launchCampaign } = await import(
  '@/app/admin/email-campaigns/actions'
)

/** Subscribers as the narrowed `select` returns them. */
function page(start: number, size: number) {
  return Array.from({ length: size }, (_, i) => ({
    email: `contact${String(start + i).padStart(6, '0')}@example.com`,
    firstName: 'Test',
    lastName: `User${start + i}`,
    phone: null,
    customFields: null,
  }))
}

function listForm(overrides: Record<string, string> = {}) {
  const form = new FormData()
  form.set('name', 'August blast')
  form.set('templateId', 'template-1')
  form.set('subject', 'New salsa is in')
  form.set('recipientsSource', 'list')
  form.set('listId', 'list-1')
  for (const [key, value] of Object.entries(overrides)) form.set(key, value)
  return form
}

type Query = {
  take?: number
  skip?: number
  cursor?: unknown
  where?: Record<string, unknown>
  select?: Record<string, unknown>
  include?: unknown
}

beforeEach(() => {
  vi.clearAllMocks()
  listFindUnique.mockResolvedValue({ id: 'list-1' })
  templateFindUnique.mockResolvedValue({ id: 'template-1' })
  campaignCreate.mockResolvedValue({ id: 'campaign-1' })
  recipientCreateMany.mockImplementation(async ({ data }) => ({ count: data.length }))
})

describe('createCampaign from a mailing list', () => {
  it('pages through the subscribers instead of loading the list', async () => {
    subscriberCount.mockResolvedValue(1500)
    subscriberFindMany
      .mockResolvedValueOnce(page(0, BATCH))
      .mockResolvedValueOnce(page(BATCH, 500))

    const result = await createCampaign(listForm())

    expect(result).toMatchObject({ success: true, recipientsCount: 1500 })

    // The list row itself must not drag its subscribers along.
    const listQuery = listFindUnique.mock.calls[0][0] as Query
    expect(listQuery.include).toBeUndefined()
    expect(listQuery.select).toEqual({ id: true })

    expect(subscriberFindMany).toHaveBeenCalledTimes(2)
    const first = subscriberFindMany.mock.calls[0][0] as Query
    expect(first.take).toBeGreaterThan(0)
    expect(first.take).toBeLessThanOrEqual(BATCH)
    expect(first.cursor).toBeUndefined()

    // A keyset predicate, not a growing `skip` (which rescans every row it
    // steps over) and not a Prisma `cursor` (which has to locate the boundary
    // row, so deleting that subscriber mid-run would end the read early).
    const second = subscriberFindMany.mock.calls[1][0] as Query
    expect(second.skip).toBeUndefined()
    expect(second.cursor).toBeUndefined()
    expect(second.where).toMatchObject({
      listId: 'list-1',
      email: { gt: page(0, BATCH)[BATCH - 1].email },
    })
  })

  it('keeps reading after the boundary subscriber is deleted mid-run', async () => {
    subscriberCount.mockResolvedValue(1500)
    subscriberFindMany
      .mockResolvedValueOnce(page(0, BATCH))
      .mockResolvedValueOnce(page(BATCH, 500))

    await createCampaign(listForm())

    // A `cursor` on a row that no longer exists returns nothing, silently
    // dropping every subscriber past that point. `gt` does not care.
    const second = subscriberFindMany.mock.calls[1][0] as Query
    expect(second.where!.email).toEqual({ gt: page(0, BATCH)[BATCH - 1].email })
    expect(recipientCreateMany).toHaveBeenCalledTimes(2)
  })

  it('writes recipients in batches rather than one nested create', async () => {
    subscriberCount.mockResolvedValue(1500)
    subscriberFindMany
      .mockResolvedValueOnce(page(0, BATCH))
      .mockResolvedValueOnce(page(BATCH, 500))

    await createCampaign(listForm())

    // The bug was `recipients: { create: [...] }` on the campaign row.
    const created = campaignCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(created.data).not.toHaveProperty('recipients')
    expect(created.data.totalRecipients).toBe(1500)

    expect(
      recipientCreateMany.mock.calls.map(([arg]) => (arg.data as unknown[]).length),
    ).toEqual([BATCH, 500])
  })

  it('leaves customFields unfetched unless a mapping reads it', async () => {
    subscriberCount.mockResolvedValue(10)
    subscriberFindMany.mockResolvedValue(page(0, 10))

    await createCampaign(
      listForm({
        variableMappings: JSON.stringify({
          coupon: { source: 'static', value: 'SAVE10' },
        }),
      }),
    )

    // `customFields` is where the importer parks every unmapped CSV column —
    // the blob that made each row expensive.
    const select = (subscriberFindMany.mock.calls[0][0] as Query).select!
    expect(select.customFields).toBe(false)
    expect(select.email).toBe(true)
  })

  it('fetches customFields when a mapping actually reads one', async () => {
    subscriberCount.mockResolvedValue(10)
    subscriberFindMany.mockResolvedValue(page(0, 10))

    await createCampaign(
      listForm({
        variableMappings: JSON.stringify({
          city: { source: 'customField', key: 'city' },
        }),
      }),
    )

    expect((subscriberFindMany.mock.calls[0][0] as Query).select!.customFields).toBe(true)
  })

  it('reconciles the total when subscribers leave between the count and the read', async () => {
    subscriberCount.mockResolvedValue(1200)
    subscriberFindMany.mockResolvedValueOnce(page(0, 900))

    const result = await createCampaign(listForm())

    expect(result).toMatchObject({ success: true, recipientsCount: 900 })
    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { totalRecipients: 900 },
    })
  })

  it('rejects an empty list before creating a campaign row', async () => {
    subscriberCount.mockResolvedValue(0)

    const result = await createCampaign(listForm())

    expect(result).toMatchObject({ error: 'No valid recipients found' })
    expect(campaignCreate).not.toHaveBeenCalled()
    expect(subscriberFindMany).not.toHaveBeenCalled()
  })

  it('rolls the campaign back when the read materialises nobody', async () => {
    // The count saw subscribers; by the time the read ran they had all gone.
    subscriberCount.mockResolvedValue(1200)
    subscriberFindMany.mockResolvedValueOnce([])

    const result = await createCampaign(listForm())

    expect(result).toMatchObject({ error: 'No valid recipients found' })
    expect(campaignDelete).toHaveBeenCalledWith({ where: { id: 'campaign-1' } })
    expect(campaignUpdate).not.toHaveBeenCalled()
  })

  it('rolls the campaign back when a recipient batch fails', async () => {
    subscriberCount.mockResolvedValue(1500)
    subscriberFindMany
      .mockResolvedValueOnce(page(0, BATCH))
      .mockResolvedValueOnce(page(BATCH, 500))
    recipientCreateMany.mockRejectedValueOnce(new Error('write failed'))

    const result = await createCampaign(listForm())

    // Splitting the write off the create lost its atomicity; without the undo a
    // recipient-less DRAFT would sit in the list looking like a success.
    expect(result).toMatchObject({ error: 'Failed to create campaign' })
    expect(campaignDelete).toHaveBeenCalledWith({ where: { id: 'campaign-1' } })
  })
})

describe('launchCampaign', () => {
  it('refuses a draft whose recipients were only half written', async () => {
    // A create killed by a timeout or a deployment leaves the batches that
    // landed and nothing to undo them.
    campaignFindUnique.mockResolvedValue({
      id: 'campaign-1',
      status: 'DRAFT',
      totalRecipients: 22_000,
      startedAt: null,
    })
    recipientCount.mockResolvedValue(9_000)

    const result = await launchCampaign('campaign-1')

    expect(result.error).toContain('9000 of 22000')
    expect(recipientUpdateMany).not.toHaveBeenCalled()
    expect(campaignUpdate).not.toHaveBeenCalled()
  })

  it('launches a draft whose recipients are all present', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'campaign-1',
      status: 'DRAFT',
      totalRecipients: 22_000,
      startedAt: null,
    })
    recipientCount.mockResolvedValue(22_000)

    const result = await launchCampaign('campaign-1')

    expect(result).toMatchObject({ success: true })
    expect(campaignUpdate).toHaveBeenCalled()
  })
})
