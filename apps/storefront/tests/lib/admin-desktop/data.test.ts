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
  auditLog: { count: vi.fn(), findMany: vi.fn() },
  blogPost: { findMany: vi.fn() },
  chatThread: { findMany: vi.fn() },
  contactSubmission: { findMany: vi.fn() },
  conversation: { findMany: vi.fn() },
  customer: { count: vi.fn(), findMany: vi.fn() },
  emailCampaign: { count: vi.fn(), findMany: vi.fn() },
  featuredEvent: { count: vi.fn(), findMany: vi.fn() },
  fundraiser: { count: vi.fn(), findMany: vi.fn() },
  fundraiserParticipant: { count: vi.fn(), findMany: vi.fn() },
  invoice: { findMany: vi.fn() },
  lead: { findMany: vi.fn() },
  ledgerEntry: { count: vi.fn(), findMany: vi.fn() },
  media: { findMany: vi.fn() },
  notification: { count: vi.fn() },
  order: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  orderItem: { count: vi.fn(), groupBy: vi.fn() },
  payment: { count: vi.fn() },
  paymentProviderConfig: { findMany: vi.fn() },
  product: { count: vi.fn(), findMany: vi.fn() },
  purchaseOrder: { findMany: vi.fn() },
  quickBooksConnection: { findFirst: vi.fn() },
  review: { count: vi.fn(), findMany: vi.fn() },
  seoConfiguration: { findFirst: vi.fn() },
  shippingCarrier: { findMany: vi.fn() },
  socialMediaPost: { findMany: vi.fn() },
  thirdPartyIntegration: { findMany: vi.fn() },
  user: { count: vi.fn(), findMany: vi.fn() },
  wholesaleAccount: { findMany: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}))

const { loadSection } = await import('@/lib/admin-desktop/data')
const { isBindableShortcut } = await import('@/lib/admin-desktop/shortcuts')

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

describe('every section', () => {
  it('draws its own data rather than handing off to the web admin', async () => {
    // The desktop window is the whole admin, not a launcher for it: a section
    // that fell back to a link card would be a hole in that promise.
    for (const section of DESKTOP_SECTIONS) {
      const payload = await loadSection(section.id)
      expect(payload.body.view).not.toBe('link')
      expect(payload.kind).toBe(section.kind)
    }
  })

  it('gives every section filter chips and a first chip that filters nothing', async () => {
    for (const section of DESKTOP_SECTIONS) {
      const payload = await loadSection(section.id)
      expect(payload.filters.length).toBeGreaterThan(0)

      if (payload.body.view === 'table') {
        // Chip 0 is the unfiltered view, so every row must be in bucket 0 or
        // the default view would hide rows the totals still count.
        for (const row of payload.body.rows) expect(row.buckets).toContain(0)
      }
    }
  })

  it('matches each table totals row to its column count', async () => {
    // A short totals row silently slides every figure under the wrong heading.
    for (const section of DESKTOP_SECTIONS) {
      const payload = await loadSection(section.id)
      if (payload.body.view !== 'table') continue
      expect(payload.body.totals).toHaveLength(payload.body.columns.length)
    }
  })

  it('keeps every inspector action pointed somewhere real', async () => {
    for (const section of DESKTOP_SECTIONS) {
      const payload = await loadSection(section.id)
      if (payload.body.view !== 'table') continue

      for (const row of payload.body.rows) {
        for (const action of row.inspector.actions ?? []) {
          expect(action.href).toMatch(/^(\/|https?:)/)
          // A shortcut the shell already owns would never reach the button.
          if (action.shortcut) expect(isBindableShortcut(action.shortcut)).toBe(true)
        }
      }
    }
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

describe('purchase orders', () => {
  it('adds freight to the line total rather than reporting goods alone', async () => {
    prismaMock.purchaseOrder.findMany.mockResolvedValue([
      {
        id: 'po1',
        poNumber: 'PO-1184',
        status: 'SUBMITTED',
        expectedAt: new Date('2026-09-18T12:00:00Z'),
        submittedAt: new Date('2026-09-11T12:00:00Z'),
        receivedAt: null,
        cancelledAt: null,
        shippingCost: 100,
        supplier: { name: 'Ohio Pepper Co', city: 'Columbus', state: 'OH', email: null },
        createdBy: null,
        items: [
          { quantityOrdered: 400, quantityReceived: 0, unitCost: 3.21, product: { name: 'Jalapeño', sku: 'JAL' } },
          { quantityOrdered: 220, quantityReceived: 20, unitCost: 4, product: { name: 'Habanero', sku: 'HAB' } },
        ],
      },
    ])

    const payload = await loadSection('purchase')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[3].text).toBe('620') // jars ordered
    // 400 × 3.21 + 220 × 4 = 2,164, plus 100 freight.
    expect(row.cells[4].text).toBe('$2,264.00')
    expect(row.cells[2].text).toBe('400 × Jalapeño +1 more')
  })
})

describe('invoices', () => {
  it('reads an unpaid invoice past its due date as overdue whatever the stored status says', async () => {
    // A nightly job moves SENT to OVERDUE; until it runs, the date is the truth.
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'i1',
        number: 'INV-3066',
        customerId: null,
        orderId: null,
        status: 'SENT',
        dueDate: new Date('2020-01-01T12:00:00Z'),
        total: 940,
        lines: [],
        notes: null,
        sentAt: null,
        paidAt: null,
        createdAt: new Date('2019-12-01T12:00:00Z'),
      },
    ])

    const payload = await loadSection('invoices')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[5].text).toBe('Overdue')
    expect(row.cells[5].tone).toBe('bad')
    // Chip 2 is "Overdue", so the chip agrees with the cell.
    expect(payload.filters[2]).toBe('Overdue')
    expect(row.buckets).toContain(2)
  })

  it('leaves a paid invoice out of the outstanding total', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'i2',
        number: 'INV-3070',
        customerId: null,
        orderId: null,
        status: 'PAID',
        dueDate: new Date('2020-01-01T12:00:00Z'),
        total: 798,
        lines: null,
        notes: null,
        sentAt: null,
        paidAt: new Date('2019-12-20T12:00:00Z'),
        createdAt: new Date('2019-12-01T12:00:00Z'),
      },
    ])

    const payload = await loadSection('invoices')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    expect(payload.body.rows[0].cells[5].text).toBe('Paid')
    expect(payload.body.totals[3].text).toBe('')
  })

  it('survives a lines column that is not the shape it expects', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'i3',
        number: 'INV-3081',
        customerId: null,
        orderId: null,
        status: 'DRAFT',
        dueDate: new Date('2030-01-01T12:00:00Z'),
        total: 10,
        lines: { not: 'an array' },
        notes: null,
        sentAt: null,
        paidAt: null,
        createdAt: new Date('2029-12-01T12:00:00Z'),
      },
    ])

    const payload = await loadSection('invoices')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const lines = payload.body.rows[0].inspector.groups.find((group) => group.label === 'LINES')
    expect(lines?.lines).toEqual([])
  })
})

describe('messages', () => {
  it('merges conversations, the contact form and live chat into one list, newest first', async () => {
    prismaMock.contactSubmission.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Cardinal Fine Foods',
        email: 'ap@cardinal.example',
        subject: 'Wholesale application',
        message: 'We carry salsa in three stores.',
        ip: null,
        createdAt: new Date('2026-09-14T13:04:00Z'),
      },
    ])
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'cv1',
        subject: 'Where is my order?',
        userId: 'u9',
        email: null,
        status: 'OPEN',
        createdAt: new Date('2026-09-16T09:00:00Z'),
        updatedAt: new Date('2026-09-16T10:00:00Z'),
        user: { name: 'Greg Sturtz', email: 'gsturtz@example.com' },
        messages: [{ senderType: 'USER', body: 'Any update?', createdAt: new Date('2026-09-16T10:00:00Z') }],
        _count: { messages: 3 },
      },
    ])
    prismaMock.chatThread.findMany.mockResolvedValue([
      {
        id: 't1',
        status: 'WAITING',
        source: 'storefront',
        customerName: 'Tom Girard',
        customerEmail: 'tom@example.com',
        assignedAdminId: null,
        startedAt: new Date('2026-09-15T13:00:00Z'),
        lastMessageAt: new Date('2026-09-15T14:15:00Z'),
        closedAt: null,
        _count: { messages: 4 },
      },
    ])

    const payload = await loadSection('messages')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    // The support inbox is the canonical one and must not be missing: the web
    // panel at /admin/messages reads Conversation, so the shell has to too.
    expect(payload.body.rows.map((row) => row.cells[0].text)).toEqual([
      'Greg Sturtz',
      'Tom Girard',
      'Cardinal Fine Foods',
    ])
    expect(payload.body.rows.map((row) => row.cells[2].text)).toEqual([
      'Conversation',
      'Live chat',
      'Web form',
    ])

    // Chip 4 is "Open" — the open conversation and the waiting chat thread.
    expect(payload.filters[4]).toBe('Open')
    expect(payload.body.rows[0].buckets).toContain(4)
    expect(payload.body.rows[1].buckets).toContain(4)
    expect(payload.body.rows[2].buckets).not.toContain(4)
    expect(payload.body.totals[4].text).toBe('2 open')
  })

  it('opens a live chat on the live thread route, not the conversation one', async () => {
    // /admin/messages/<id> loads a Conversation; a ChatThread id there is a 404.
    prismaMock.chatThread.findMany.mockResolvedValue([
      {
        id: 't9',
        status: 'ACTIVE',
        source: 'storefront',
        customerName: 'Iris Pham',
        customerEmail: null,
        assignedAdminId: null,
        startedAt: new Date('2026-09-15T13:00:00Z'),
        lastMessageAt: new Date('2026-09-15T13:30:00Z'),
        closedAt: null,
        _count: { messages: 2 },
      },
    ])

    const payload = await loadSection('messages')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    expect(payload.body.rows[0].href).toBe('/admin/messages/live/t9')
    expect(payload.body.rows[0].inspector.actions?.[0].href).toBe('/admin/messages/live/t9')
  })
})

describe('media', () => {
  it('asks for alt text on an image and not on a PDF', async () => {
    prismaMock.media.findMany.mockResolvedValue([
      {
        id: 'm1',
        url: '/media/jar.jpg',
        filename: 'jar.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1_468_006,
        alt: null,
        caption: null,
        width: 2000,
        height: 2000,
        createdAt: new Date('2026-09-12T12:00:00Z'),
        _count: { socialMediaPosts: 0, mediaTags: 0 },
      },
      {
        id: 'm2',
        url: '/media/sheet.pdf',
        filename: 'price-sheet.pdf',
        mimeType: 'application/pdf',
        fileSize: 612_000,
        alt: null,
        caption: null,
        width: null,
        height: null,
        createdAt: new Date('2026-09-11T12:00:00Z'),
        _count: { socialMediaPosts: 0, mediaTags: 0 },
      },
    ])

    const payload = await loadSection('media')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [image, pdf] = payload.body.rows
    expect(image.cells[1].text).toBe('Photo')
    expect(image.cells[2].text).toBe('1.4 MB')
    expect(image.cells[3].text).toBe('2000×2000')
    expect(image.cells[4].text).toBe('Missing')
    expect(pdf.cells[4].text).toBe('—')
    expect(payload.body.totals[4].text).toBe('1 need alt text')
  })
})

describe('users', () => {
  it('asks only for the roles that can reach the admin panel', async () => {
    await loadSection('users')

    const where = prismaMock.user.findMany.mock.calls.at(-1)?.[0]?.where
    expect(where).toEqual({ role: { in: ['DEVELOPER', 'ADMIN', 'STAFF'] } })
  })

  it('counts two-factor enrolment from the confirmed timestamp, not the secret', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        name: 'Mike Madrid',
        email: 'mike@josemadrid.net',
        role: 'DEVELOPER',
        isEmailVerified: true,
        twoFactorEnabledAt: new Date('2026-03-01T12:00:00Z'),
        lastLoginAt: new Date('2026-09-14T13:12:00Z'),
        createdAt: new Date('2021-03-01T12:00:00Z'),
      },
      {
        id: 'u2',
        name: 'Casey Lin',
        email: 'casey@josemadrid.net',
        role: 'STAFF',
        isEmailVerified: false,
        twoFactorEnabledAt: null,
        lastLoginAt: null,
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ])

    const payload = await loadSection('users')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    expect(payload.body.rows[0].cells[3].text).toBe('Enabled')
    expect(payload.body.rows[1].cells[3].text).toBe('Disabled')
    expect(payload.body.rows[1].cells[4].text).toBe('Never')
    expect(payload.body.totals[3].text).toBe('1 with 2FA')
    expect(payload.body.totals[3].tone).toBe('warn')
  })
})

describe('content', () => {
  it('measures the SEO budget against the values the page would actually publish', async () => {
    // With no override the storefront falls back to the title and excerpt, so
    // that is what the character count has to be taken from.
    prismaMock.blogPost.findMany.mockResolvedValue([
      {
        id: 'b1',
        slug: 'small-batch',
        title: 'What makes a small batch',
        excerpt: 'Twelve gallons at a time.',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-09-13T12:00:00Z'),
        scheduledFor: null,
        featured: false,
        readingMinutes: 4,
        seoTitle: null,
        seoDescription: null,
        tags: ['kitchen'],
        coverImage: null,
        updatedAt: new Date('2026-09-13T12:00:00Z'),
        author: { name: 'Mike', email: 'mike@josemadrid.net' },
        category: { name: 'Kitchen' },
        series: null,
        crosspost: null,
      },
    ])

    const payload = await loadSection('content')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const seo = payload.body.rows[0].inspector.groups.find((group) => group.label === 'SEO')
    expect(seo?.fields?.[0].value).toBe('24 / 60 chars')
    expect(seo?.fields?.[1].value).toBe('25 / 160 chars')
    expect(payload.body.rows[0].href).toBe('/admin/blog/posts/small-batch')
    // The public post lives under the Heat Index, not a /blog prefix.
    const content = payload.body.rows[0].inspector.groups.find((group) => group.label === 'CONTENT')
    expect(content?.fields?.[0].value).toBe('/heat-index/small-batch')
  })
})

describe('reviews', () => {
  it('reports the average rating and how many still need moderating', async () => {
    prismaMock.review.findMany.mockResolvedValue([
      {
        id: 'r1',
        rating: 5,
        title: null,
        comment: 'Best salsa we have found anywhere.',
        isVerified: true,
        status: 'PENDING',
        moderatedAt: null,
        createdAt: new Date('2026-09-13T12:00:00Z'),
        product: { id: 'p1', name: 'Black Bean & Corn' },
        user: { name: 'Karen Wolfe', email: 'karen@example.com' },
      },
      {
        id: 'r2',
        rating: 4,
        title: null,
        comment: 'Smoky and thick.',
        isVerified: false,
        status: 'APPROVED',
        moderatedAt: new Date('2026-09-10T12:00:00Z'),
        createdAt: new Date('2026-09-09T12:00:00Z'),
        product: { id: 'p2', name: 'Chipotle' },
        user: { name: 'Danielle Poe', email: 'dp@example.com' },
      },
    ])

    const payload = await loadSection('reviews')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    expect(payload.body.rows[0].cells[2].text).toBe('★★★★★')
    expect(payload.body.rows[1].cells[2].text).toBe('★★★★☆')
    expect(payload.body.totals[2].text).toBe('4.50 avg')
    expect(payload.body.totals[5].text).toBe('1 pending')
  })
})
