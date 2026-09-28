import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL,
  countsTowardCampaign,
  ensureBigCommerceFundraiser,
  extractFundraisingAttribution,
  recomputeFundraiserTotals,
} from '@/lib/bigcommerce/fundraising-orders'

type Row = { id: string; slug: string; bigCommerceGroup: string; commissionRate: number; startDate: Date; endDate: Date }

// A small in-memory fundraiser table, so find-or-create can be exercised across calls.
const rows = vi.hoisted(() => [] as Row[])
const db = vi.hoisted(() => ({
  fundraiser: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  order: { aggregate: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))

beforeEach(() => {
  rows.length = 0
  for (const fn of [...Object.values(db.fundraiser), ...Object.values(db.order)]) fn.mockReset()
  db.fundraiser.findUnique.mockImplementation(async ({ where }: { where: { bigCommerceGroup: string } }) =>
    rows.find((row) => row.bigCommerceGroup === where.bigCommerceGroup) ?? null,
  )
  db.fundraiser.findMany.mockImplementation(async ({ where }: { where: { slug: { startsWith: string } } }) =>
    rows.filter((row) => row.slug.startsWith(where.slug.startsWith)).map(({ slug }) => ({ slug })),
  )
  db.fundraiser.create.mockImplementation(async ({ data }: { data: Row }) => {
    const row = { ...data, id: `f-${rows.length + 1}` }
    rows.push(row)
    return { id: row.id, commissionRate: row.commissionRate }
  })
  db.fundraiser.updateMany.mockImplementation(
    async ({ where, data }: { where: { id: string; startDate?: { gt: Date }; endDate?: { lt: Date } }; data: Partial<Row> }) => {
      const row = rows.find(
        (r) =>
          r.id === where.id &&
          (!where.startDate || r.startDate > where.startDate.gt) &&
          (!where.endDate || r.endDate < where.endDate.lt),
      )
      if (row) Object.assign(row, data)
      return { count: row ? 1 : 0 }
    },
  )
  db.fundraiser.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
    const row = rows.find((r) => r.id === where.id)
    if (row) Object.assign(row, data)
    return row ?? null
  })
})

describe('extractFundraisingAttribution', () => {
  it.each([
    ['Fundraiser Group', 'Salesperson'],
    ['Fundraiser Group ', 'Sales Person'],
    ['Fundraising Group name ', 'Salesperson'],
    ['  fundraising group', 'sales person '],
  ])('reads the group from %j and the seller from %j', (groupLabel, sellerLabel) => {
    const billing = {
      form_fields: [
        { name: 'Order Notes', value: 'leave at door' },
        { name: groupLabel, value: ' Leavenworth Soccer Association ' },
        { name: sellerLabel, value: ' Sam ' },
      ],
    }
    expect(extractFundraisingAttribution(billing)).toEqual({ group: 'Leavenworth Soccer Association', seller: 'Sam' })
  })

  it('falls back to the shipping address and ignores blank answers', () => {
    const billing = { form_fields: [{ name: 'Fundraiser Group', value: '  ' }] }
    const shipping = [{ form_fields: [{ name: 'Fundraiser Group', value: 'Dragon Guard' }] }]
    expect(extractFundraisingAttribution(billing, shipping)).toEqual({ group: 'Dragon Guard', seller: null })
  })

  it('returns nothing for an order with no checkout answers', () => {
    expect(extractFundraisingAttribution({ form_fields: [] })).toEqual({ group: null, seller: null })
    expect(extractFundraisingAttribution(null)).toEqual({ group: null, seller: null })
  })
})

describe('ensureBigCommerceFundraiser', () => {
  const jan = new Date('2023-01-10T00:00:00Z')

  it('creates an inactive, already-closed fundraiser whose coordinator emails can never send', async () => {
    const ref = await ensureBigCommerceFundraiser('  Leavenworth  Soccer Association ', jan)

    expect(ref).toEqual({ id: 'f-1', commissionRate: 50, created: true })
    expect(db.fundraiser.create.mock.calls[0][0].data).toMatchObject({
      name: 'Leavenworth Soccer Association',
      organizationName: 'Leavenworth Soccer Association',
      slug: 'leavenworth-soccer-association',
      bigCommerceGroup: 'leavenworth soccer association',
      contactEmail: BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL,
      startDate: jan,
      endDate: jan,
      commissionRate: 50,
      defaultUnitPrice: 10,
      isActive: false,
      status: 'ENDED',
      launchEmailSentAt: expect.any(Date),
      summaryEmailSentAt: expect.any(Date),
    })
  })

  it('treats case, spacing and curly apostrophes as the same group', async () => {
    const a = await ensureBigCommerceFundraiser("BGSU Equestrian Fall '21", jan)
    const b = await ensureBigCommerceFundraiser('bgsu  equestrian fall ’21 ', jan)
    const c = await ensureBigCommerceFundraiser('Harper Creek band Boosters', jan)
    const d = await ensureBigCommerceFundraiser('Harper Creek Band Boosters', jan)

    expect(b).toMatchObject({ id: a.id, created: false })
    expect(d).toMatchObject({ id: c.id, created: false })
    expect(db.fundraiser.create).toHaveBeenCalledTimes(2)
  })

  it('keeps each season its own campaign, with a distinct slug', async () => {
    const first = await ensureBigCommerceFundraiser('Theta Phi Alpha 2023', jan)
    const second = await ensureBigCommerceFundraiser('Theta Phi Alpha 2024', jan)
    expect(first.id).not.toBe(second.id)
    expect(rows.map((row) => row.slug)).toEqual(['theta-phi-alpha-2023', 'theta-phi-alpha-2024'])
  })

  it('suffixes the slug when another fundraiser already uses it', async () => {
    rows.push({ id: 'native', slug: 'dragon-guard', bigCommerceGroup: '', commissionRate: 50, startDate: jan, endDate: jan })
    await ensureBigCommerceFundraiser('Dragon Guard', jan)
    expect(rows[1].slug).toBe('dragon-guard-2')
  })

  it('stretches the campaign dates to cover every order', async () => {
    await ensureBigCommerceFundraiser('Dragon Guard', jan)
    await ensureBigCommerceFundraiser('Dragon Guard', new Date('2023-03-01T00:00:00Z'))
    await ensureBigCommerceFundraiser('Dragon Guard', new Date('2022-12-01T00:00:00Z'))
    await ensureBigCommerceFundraiser('Dragon Guard', new Date('2023-02-01T00:00:00Z'))

    expect(rows[0].startDate).toEqual(new Date('2022-12-01T00:00:00Z'))
    expect(rows[0].endDate).toEqual(new Date('2023-03-01T00:00:00Z'))
    expect(db.fundraiser.updateMany).toHaveBeenCalledTimes(2)
  })

  it('uses the row a concurrent caller created when its own insert loses the race', async () => {
    db.fundraiser.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'f-race',
      commissionRate: new Prisma.Decimal(50),
      startDate: jan,
      endDate: jan,
    })
    db.fundraiser.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    )
    await expect(ensureBigCommerceFundraiser('Dragon Guard', jan)).resolves.toEqual({
      id: 'f-race',
      commissionRate: 50,
      created: false,
    })
  })
})

describe('countsTowardCampaign', () => {
  it('counts paid orders that were not cancelled or refunded', () => {
    expect(countsTowardCampaign('SHIPPED', 'PAID')).toBe(true)
    expect(countsTowardCampaign('PROCESSING', 'PARTIALLY_REFUNDED')).toBe(true)
    expect(countsTowardCampaign('REFUNDED', 'REFUNDED')).toBe(false)
    expect(countsTowardCampaign('CANCELLED', 'CANCELED')).toBe(false)
    expect(countsTowardCampaign('PENDING', 'PENDING')).toBe(false)
  })
})

describe('recomputeFundraiserTotals', () => {
  it('rewrites the rollups from the counted orders', async () => {
    db.order.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _sum: { total: new Prisma.Decimal('60.00'), fundraiserCommission: new Prisma.Decimal('15.00') },
    })

    await recomputeFundraiserTotals('f-1')

    expect(db.order.aggregate).toHaveBeenCalledWith({
      where: {
        fundraiserId: 'f-1',
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _count: { _all: true },
      _sum: { total: true, fundraiserCommission: true },
    })
    const data = db.fundraiser.update.mock.calls[0][0].data
    expect(data.totalOrders).toBe(3)
    expect(Number(data.totalRevenue)).toBe(60)
    expect(Number(data.totalCommission)).toBe(15)
  })

  it('zeroes a fundraiser with no counted orders', async () => {
    db.order.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { total: null, fundraiserCommission: null } })
    await recomputeFundraiserTotals('f-1')
    const data = db.fundraiser.update.mock.calls[0][0].data
    expect([data.totalOrders, Number(data.totalRevenue), Number(data.totalCommission)]).toEqual([0, 0, 0])
  })
})
