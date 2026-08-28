import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

import { DESKTOP_SECTIONS } from '@/lib/admin-desktop/sections'
import { ADMIN_ROUTES, isRealAdminRoute } from '../../helpers/admin-routes'

/**
 * The loaders are exercised against a stubbed Prisma client. The point is not to
 * re-test Prisma but to pin the two things that would silently produce wrong
 * numbers: which rows count as a sale, and what happens when a table is missing.
 */

const prismaMock = {
  order: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  orderItem: { count: vi.fn(), groupBy: vi.fn() },
  product: { findMany: vi.fn(), count: vi.fn() },
  customer: { findMany: vi.fn(), count: vi.fn() },
  user: { findMany: vi.fn(), count: vi.fn() },
  payment: { count: vi.fn() },
  fundraiser: { findMany: vi.fn(), count: vi.fn() },
  fundraiserParticipant: { findMany: vi.fn(), count: vi.fn() },
  ledgerEntry: { findMany: vi.fn(), count: vi.fn() },
  featuredEvent: { findMany: vi.fn(), count: vi.fn() },
  review: { count: vi.fn() },
  emailCampaign: { count: vi.fn() },
  auditLog: { findMany: vi.fn(), count: vi.fn() },
  notification: { count: vi.fn() },
  seoConfiguration: { findFirst: vi.fn() },
  quickBooksConnection: { findFirst: vi.fn() },
  paymentProviderConfig: { findMany: vi.fn() },
  shippingCarrier: { findMany: vi.fn() },
  thirdPartyIntegration: { findMany: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}))

const { loadSection } = await import('@/lib/admin-desktop/data')

/** Shared row fixtures — the sections whose rows carry an href. */

const orderFixture = {
  id: 'o1',
  orderNumber: 'JMS-24817',
  total: 71.4,
  subtotal: 65,
  shippingCost: 4,
  tax: 2.4,
  discountAmount: 0,
  status: 'SHIPPED',
  paymentStatus: 'PAID',
  fulfillmentStatus: 'FULFILLED',
  salesChannel: 'WEBSITE',
  createdAt: new Date('2026-09-14T12:12:00Z'),
  shippingMethod: 'USPS Priority',
  trackingNumber: null,
  guestEmail: null,
  user: { name: 'Karen Wolfe', email: 'karen@example.com' },
  shippingAddress: { firstName: 'Karen', lastName: 'Wolfe', city: 'Granville', state: 'OH' },
  items: [{ quantity: 4 }, { quantity: 2 }],
}

const productFixture = {
  id: 'p3',
  name: 'Peach',
  sku: 'JMS-PCH-16',
  heatLevel: 'FRUIT',
  price: 11.95,
  compareAtPrice: null,
  costPrice: null,
  inventory: 100,
  stockReserved: 0,
  lowStockThreshold: 12,
  unitsPerCase: 12,
  stockStatus: 'IN_STOCK',
  isActive: true,
  updatedAt: new Date('2026-09-10T12:00:00Z'),
  category: { name: 'Fruit' },
}

const customerFixture = {
  id: 'c1',
  firstName: 'Vera',
  lastName: 'Ortiz',
  // The + and @ have to survive into the query string intact.
  email: 'vera+shows@example.com',
  phone: null,
  accountType: 'STANDARD',
  source: 'BIGCOMMERCE',
  sourceName: null,
  emailStatus: null,
  notes: null,
  totalOrders: 3,
  totalSpent: 128.4,
  lastOrderAt: new Date('2026-09-01T12:00:00Z'),
}

const eventFixture = {
  id: 'e1',
  title: 'Zanesville Harvest Festival',
  bookingStatus: 'CONFIRMED',
  startDate: new Date('2026-09-20T12:00:00Z'),
  endDate: new Date('2026-09-21T12:00:00Z'),
  venue: 'Secrest Auditorium',
  location: null,
  city: 'Zanesville',
  state: 'OH',
  eventTimes: null,
  driveTime: null,
  boothFee: 120,
  costOfFuel: null,
  lodging: null,
  meals: null,
  otherExpenses: null,
  cashSales: 410,
  cardSales: 260,
  attendance: null,
}

function missingTable(table: string) {
  return new Prisma.PrismaClientKnownRequestError(`The table \`${table}\` does not exist`, {
    code: 'P2021',
    clientVersion: 'test',
    meta: { table },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const model of Object.values(prismaMock)) {
    for (const [name, fn] of Object.entries(model)) {
      if (name === 'count') fn.mockResolvedValue(0)
      else if (name === 'aggregate') fn.mockResolvedValue({ _sum: { total: null }, _count: { _all: 0 } })
      else if (name === 'findFirst') fn.mockResolvedValue(null)
      else fn.mockResolvedValue([])
    }
  }
})

describe('link sections', () => {
  it('hands off to the web admin without touching the database', async () => {
    const payload = await loadSection('wholesale')

    expect(payload.kind).toBe('link')
    expect(payload.body.view).toBe('link')
    if (payload.body.view !== 'link') throw new Error('expected a link payload')
    expect(payload.body.views.length).toBeGreaterThan(0)
    expect(prismaMock.order.findMany).not.toHaveBeenCalled()
  })
})

describe('orders', () => {
  it('sums jars from the line items rather than trusting a header field', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        orderNumber: 'JMS-24817',
        total: 71.4,
        subtotal: 65,
        shippingCost: 4,
        tax: 2.4,
        discountAmount: 0,
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'FULFILLED',
        salesChannel: 'WEBSITE',
        createdAt: new Date('2026-09-14T12:12:00Z'),
        shippingMethod: 'USPS Priority',
        trackingNumber: null,
        guestEmail: null,
        user: { name: 'Karen Wolfe', email: 'karen@example.com' },
        shippingAddress: { firstName: 'Karen', lastName: 'Wolfe', city: 'Granville', state: 'OH' },
        items: [{ quantity: 4 }, { quantity: 2 }],
      },
    ])

    const payload = await loadSection('orders')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[1].text).toBe('Karen Wolfe')
    expect(row.cells[2].text).toBe('Granville, OH')
    expect(row.cells[3].text).toBe('Online')
    expect(row.cells[4].text).toBe('6')
    expect(row.cells[5].text).toBe('$71.40')
    expect(row.href).toBe('/admin/orders/o1')
  })

  it('puts a row in the channel bucket its chip filters on', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'o2',
        orderNumber: 'JMS-24816',
        total: 812,
        subtotal: 812,
        shippingCost: 0,
        tax: 0,
        discountAmount: 0,
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'UNFULFILLED',
        salesChannel: 'WHOLESALE',
        createdAt: new Date('2026-09-14T11:40:00Z'),
        shippingMethod: null,
        trackingNumber: null,
        guestEmail: 'buyer@laperla.example',
        user: null,
        shippingAddress: null,
        items: [{ quantity: 96 }],
      },
    ])

    const payload = await loadSection('orders')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    // Chip 0 is "All channels", chip 2 is "Wholesale".
    expect(payload.body.rows[0].buckets).toEqual([0, 2])
    expect(payload.filters[2]).toBe('Wholesale')
  })
})

describe('inventory', () => {
  it('reads availability as on-hand minus reserved and flags the reorder point', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Black Bean & Corn',
        sku: 'JMS-BBC-16',
        heatLevel: 'MILD',
        inventory: 30,
        stockReserved: 26,
        lowStockThreshold: 12,
        unitsPerCase: 12,
        price: 11.95,
        costPrice: 2.32,
      },
    ])

    const payload = await loadSection('inventory')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[3].text).toBe('30') // on hand
    expect(row.cells[4].text).toBe('26') // reserved
    expect(row.cells[5].text).toBe('4') // available
    expect(row.cells[8].text).toBe('Below reorder')
    expect(row.cells[8].tone).toBe('bad')
  })

  it('calls a SKU healthy only when it is clear of twice its reorder point', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 'p2',
        name: 'Roasted Garlic',
        sku: 'JMS-RG-16',
        heatLevel: 'MEDIUM',
        inventory: 40,
        stockReserved: 0,
        lowStockThreshold: 12,
        unitsPerCase: 12,
        price: 11.95,
        costPrice: null,
      },
    ])

    const payload = await loadSection('inventory')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')
    expect(payload.body.rows[0].cells[8].text).toBe('Healthy')
  })
})

describe('products', () => {
  it('shows a dash rather than a zero margin when cost has never been set', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 'p3',
        name: 'Peach',
        sku: 'JMS-PCH-16',
        heatLevel: 'FRUIT',
        price: 11.95,
        compareAtPrice: null,
        costPrice: null,
        inventory: 100,
        stockReserved: 0,
        lowStockThreshold: 12,
        unitsPerCase: 12,
        stockStatus: 'IN_STOCK',
        isActive: true,
        updatedAt: new Date('2026-09-10T12:00:00Z'),
        category: { name: 'Fruit' },
      },
    ])

    const payload = await loadSection('products')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    expect(payload.body.rows[0].cells[5].text).toBe('—') // cost
    expect(payload.body.rows[0].cells[6].text).toBe('—') // margin
  })
})

describe('ledger', () => {
  it('separates income and expense into credit and debit columns', async () => {
    prismaMock.ledgerEntry.findMany.mockResolvedValue([
      {
        id: 'l1',
        date: new Date('2026-09-14T12:00:00Z'),
        direction: 'INCOME',
        amountCents: 112800,
        category: 'PRODUCT_SALES',
        source: 'ORDER',
        description: 'Rosecrans Boosters',
        counterparty: null,
        channel: 'FUNDRAISER',
        paymentMethod: null,
        isManual: false,
        memo: null,
        exportedAt: null,
      },
    ])

    const payload = await loadSection('ledger')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[3].text).toBe('—') // debit
    expect(row.cells[4].text).toBe('$1,128.00') // credit
    expect(row.cells[6].text).toBe('Not exported')
  })
})

describe('resilience', () => {
  it('renders an empty section when the table has not been migrated yet', async () => {
    prismaMock.ledgerEntry.findMany.mockRejectedValue(missingTable('ledger_entries'))

    const payload = await loadSection('ledger')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')
    expect(payload.body.rows).toEqual([])
  })

  it('still raises anything that is not a missing table', async () => {
    prismaMock.ledgerEntry.findMany.mockRejectedValue(new Error('connection refused'))
    await expect(loadSection('ledger')).rejects.toThrow('connection refused')
  })
})

describe('database console', () => {
  it('reports row counts and never claims a size it cannot measure', async () => {
    prismaMock.order.count.mockResolvedValue(8)
    prismaMock.product.count.mockResolvedValue(28)

    const payload = await loadSection('database')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    expect(payload.body.columns.map((column) => column.label)).toEqual(['Model', 'Table', 'Rows'])
    const products = payload.body.rows.find((row) => row.id === 'products')
    expect(products?.cells[2].text).toBe('28')
    // Sorted by row count, so the biggest table is first.
    expect(payload.body.rows[0].id).toBe('products')
  })
})

describe('customers', () => {
  it('opens a row on a page that exists, filtered to that one customer', async () => {
    // There is no /admin/customers/[id] page, so a row has to hand off to the
    // list pre-filtered by the customer's (unique) email instead of 404ing.
    prismaMock.customer.findMany.mockResolvedValue([customerFixture])

    const payload = await loadSection('customers')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.href).toBe('/admin/customers?search=vera%2Bshows%40example.com')
    expect(isRealAdminRoute(row.href!)).toBe(true)
  })
})

describe('events', () => {
  it('opens a show on its edit page rather than a bare id that has no page', async () => {
    prismaMock.featuredEvent.findMany.mockResolvedValue([eventFixture])

    const payload = await loadSection('events')
    if (payload.body.view !== 'events') throw new Error('expected an events payload')

    const [row] = payload.body.rows
    expect(row.href).toBe('/admin/events/e1/edit')
    expect(isRealAdminRoute(row.href!)).toBe(true)
  })
})

describe('every link the desktop shell can follow', () => {
  // Pressing ⏎ on a row sets window.location.href directly, so an href that
  // matches no App Router page is a dead end with no way back.
  it('has a route table to check against', () => {
    expect(ADMIN_ROUTES).toContain('/admin/customers')
    expect(ADMIN_ROUTES).toContain('/admin/events/[id]/edit')
    // The two routes these hrefs used to point at genuinely do not exist.
    expect(ADMIN_ROUTES).not.toContain('/admin/customers/[id]')
    expect(ADMIN_ROUTES).not.toContain('/admin/events/[id]')
  })

  it('resolves every header action, section path and sub-view in every section', async () => {
    const dead: string[] = []

    for (const section of DESKTOP_SECTIONS) {
      const payload = await loadSection(section.id)

      for (const action of payload.actions) {
        if (!isRealAdminRoute(action.href)) dead.push(`${section.id}: action "${action.label}" → ${action.href}`)
      }
      if (!isRealAdminRoute(payload.path)) dead.push(`${section.id}: section path → ${payload.path}`)
      if (payload.body.view === 'link') {
        for (const view of payload.body.views) {
          if (!isRealAdminRoute(view.path)) dead.push(`${section.id}: view "${view.label}" → ${view.path}`)
        }
      }
    }

    expect(dead).toEqual([])
  })

  it('resolves every row href a populated section produces', async () => {
    prismaMock.order.findMany.mockResolvedValue([orderFixture])
    prismaMock.product.findMany.mockResolvedValue([productFixture])
    prismaMock.customer.findMany.mockResolvedValue([customerFixture])
    prismaMock.featuredEvent.findMany.mockResolvedValue([eventFixture])

    const dead: string[] = []

    for (const section of DESKTOP_SECTIONS) {
      const payload = await loadSection(section.id)
      const rows = payload.body.view === 'table' || payload.body.view === 'events' ? payload.body.rows : []

      for (const row of rows) {
        if (row.href && !isRealAdminRoute(row.href)) dead.push(`${section.id}: row ${row.id} → ${row.href}`)
      }

      if (payload.body.view === 'dashboard') {
        for (const order of payload.body.todayOrders) {
          if (!isRealAdminRoute(order.href)) dead.push(`dashboard: order ${order.id} → ${order.href}`)
        }
      }
    }

    expect(dead).toEqual([])
  })
})
