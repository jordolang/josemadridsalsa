import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

import {
  DESKTOP_PAGES,
  DESKTOP_SECTIONS,
  isDesktopPageId,
  isDesktopSectionId,
} from '@/lib/admin-desktop/sections'
import { defaultValues, findForm, isWriteOpId } from '@/lib/admin-desktop/forms'
import type { DesktopCommand } from '@/lib/admin-desktop/types'
import { ADMIN_ROUTES, isRealAdminRoute, isRealAppRoute } from '../../helpers/admin-routes'

/**
 * Check one command the way the shell would run it.
 *
 * The five kinds fail in five different ways, and only one of them is a dead
 * link: a `form` naming a spec that does not exist opens nothing, a `write`
 * naming no handler is a button that silently 400s, and a `section` or `page`
 * jump to an unknown id leaves the window where it was.
 */
function commandFault(command: DesktopCommand | undefined): string | null {
  if (!command) return null

  switch (command.kind) {
    case 'open':
      return isRealAppRoute(command.href) ? null : `dead link → ${command.href}`
    case 'form': {
      const spec = findForm(command.form)
      if (!spec) return `unknown form → ${command.form}`
      // A value under a name the form does not have is silently dropped, so the
      // sheet opens looking filled in and saves something else.
      const known = new Set(Object.keys(defaultValues(spec)))
      const stray = Object.keys(command.values ?? {}).filter((name) => !known.has(name))
      return stray.length ? `${command.form} has no field(s) ${stray.join(', ')}` : null
    }
    case 'write':
      return isWriteOpId(command.op) ? null : `unknown operation → ${command.op}`
    case 'section':
      return isDesktopSectionId(command.section) ? null : `unknown section → ${command.section}`
    case 'page':
      return isDesktopPageId(command.page) ? null : `unknown page → ${command.page}`
    case 'scan':
      return null
    case 'label':
      return command.href.startsWith('https://') ? null : `label is not https → ${command.href}`
  }
}

/**
 * The loaders are exercised against a stubbed Prisma client. The point is not to
 * re-test Prisma but to pin the two things that would silently produce wrong
 * numbers: which rows count as a sale, and what happens when a table is missing.
 */

const prismaMock = {
  archiveDocument: { findMany: vi.fn() },
  archivedShowSale: { findMany: vi.fn() },
  auditLog: { count: vi.fn(), findMany: vi.fn() },
  banner: { findMany: vi.fn() },
  blogPost: { count: vi.fn(), findMany: vi.fn() },
  brandKit: { findFirst: vi.fn() },
  chatThread: { findMany: vi.fn() },
  contactSubmission: { findMany: vi.fn() },
  conversation: { findMany: vi.fn() },
  credentialAccessGrant: { findMany: vi.fn() },
  developerBlogPost: { count: vi.fn() },
  customer: { count: vi.fn(), findMany: vi.fn() },
  emailAutomation: { findMany: vi.fn() },
  emailBounce: { findMany: vi.fn() },
  emailCampaign: { count: vi.fn(), findMany: vi.fn() },
  emailConfiguration: { findFirst: vi.fn() },
  emailLog: { findMany: vi.fn() },
  emailSuppression: { findMany: vi.fn() },
  emailTemplate: { count: vi.fn(), findMany: vi.fn() },
  eventManifest: { findMany: vi.fn() },
  faqItem: { findMany: vi.fn() },
  featuredEvent: { count: vi.fn(), findMany: vi.fn() },
  formCapture: { groupBy: vi.fn() },
  formTemplate: { findMany: vi.fn() },
  fundraiser: { count: vi.fn(), findMany: vi.fn() },
  fundraiserParticipant: { count: vi.fn(), findMany: vi.fn() },
  fundraiserTeam: { findMany: vi.fn() },
  invoice: { findMany: vi.fn() },
  inboundEmail: { findMany: vi.fn() },
  lead: { findMany: vi.fn() },
  leadCampaign: { findMany: vi.fn() },
  ledgerEntry: { count: vi.fn(), findMany: vi.fn() },
  loyaltyReward: { findMany: vi.fn() },
  mailingList: { findMany: vi.fn() },
  mailingListSubscriber: { findMany: vi.fn() },
  media: { findMany: vi.fn() },
  mileageEntry: { findMany: vi.fn() },
  notification: { count: vi.fn(), findMany: vi.fn() },
  order: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  orderItem: { count: vi.fn(), groupBy: vi.fn() },
  page: { count: vi.fn(), findMany: vi.fn() },
  payment: { count: vi.fn(), groupBy: vi.fn() },
  paymentProviderConfig: { findMany: vi.fn() },
  product: { count: vi.fn(), findMany: vi.fn() },
  purchaseOrder: { findMany: vi.fn() },
  quickBooksConnection: { findFirst: vi.fn() },
  redirect: { count: vi.fn(), findMany: vi.fn() },
  retailLocation: { findMany: vi.fn() },
  returnRequest: { findMany: vi.fn() },
  review: { count: vi.fn(), findMany: vi.fn() },
  seoConfiguration: { findFirst: vi.fn() },
  serviceCredential: { findMany: vi.fn() },
  shippingCarrier: { findMany: vi.fn() },
  shippingLabel: { count: vi.fn(), findMany: vi.fn() },
  shippingSettings: { findFirst: vi.fn() },
  shopListing: { findMany: vi.fn() },
  socialAccount: { findMany: vi.fn() },
  socialMediaPost: { findMany: vi.fn() },
  socialPostPublish: { findMany: vi.fn() },
  storeSettings: { findUnique: vi.fn() },
  structuredData: { count: vi.fn() },
  supplier: { findMany: vi.fn() },
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
  slug: 'peach',
  sku: 'JMS-PCH-16',
  barcode: null,
  categoryId: 'cat-fruit',
  heatLevel: 'FRUIT',
  description: null,
  ingredients: ['Peaches', 'Habanero'],
  images: ['https://blob.example.com/peach.jpg'],
  featuredImage: 'https://blob.example.com/peach.jpg',
  ogImage: null,
  searchKeywords: ['peach', 'fruit salsa'],
  metaTitle: null,
  metaDescription: null,
  isFeatured: false,
  sortOrder: 0,
  weight: 16,
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

const rewardFixture = {
  id: 'reward-1',
  name: '$5 Off',
  description: 'Get $5 off your next order',
  pointsCost: 500,
  rewardType: 'DISCOUNT',
  rewardValue: new Prisma.Decimal(5),
  isActive: true,
  minimumTier: 'BRONZE',
  maxRedemptions: null,
  usedCount: 0,
  createdAt: new Date('2026-09-01T12:00:00Z'),
  updatedAt: new Date('2026-09-01T12:00:00Z'),
  _count: { redemptions: 0 },
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
      else if (name === 'findUnique') fn.mockResolvedValue(null)
      else if (name === 'aggregate') fn.mockResolvedValue({ _sum: { total: null }, _count: { _all: 0 } })
      else if (name === 'findFirst') fn.mockResolvedValue(null)
      else fn.mockResolvedValue([])
    }
  }
})

describe('every page', () => {
  it('draws its own data rather than handing off to the web admin', async () => {
    // The desktop window is the whole admin, not a launcher for it: a page that
    // fell back to a link card would be a hole in that promise.
    for (const { section, page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
      expect(payload.body.view, `${page.id} hands off`).not.toBe('link')
      expect(payload.kind).toBe(page.kind ?? section.kind)
      expect(payload.page).toBe(page.id)
      expect(payload.id).toBe(section.id)
    }
  })

  it('lists its section’s pages so the strip can draw them', async () => {
    for (const { section, page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
      const ids = payload.pages.map((entry) => entry.id)
      expect(ids, `${page.id} lost its strip`).toContain(page.id)
      expect(ids[0]).toBe(section.id)
    }
  })

  it('gives every page filter chips and a first chip that filters nothing', async () => {
    for (const { page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
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
    for (const { page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
      if (payload.body.view !== 'table') continue
      expect(payload.body.totals, `${page.id} totals`).toHaveLength(payload.body.columns.length)
    }
  })

  it('keeps every inspector action pointed at something the shell can run', async () => {
    for (const { page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
      if (payload.body.view !== 'table') continue

      for (const row of payload.body.rows) {
        for (const action of row.inspector.actions ?? []) {
          expect(commandFault(action.command)).toBeNull()
          // A shortcut the shell already owns would never reach the button.
          if (action.shortcut) expect(isBindableShortcut(action.shortcut)).toBe(true)
        }
      }
    }
  })

  it('never binds one shortcut to two actions on the same row', async () => {
    // Two buttons on one key means the first one found wins and the other is
    // unreachable from the keyboard, which is invisible until somebody tries.
    const clashes: string[] = []

    for (const { page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
      const rows = payload.body.view === 'table' || payload.body.view === 'events' ? payload.body.rows : []

      for (const row of rows) {
        const seen = new Set<string>()
        for (const action of row.inspector.actions ?? []) {
          if (!action.shortcut) continue
          if (seen.has(action.shortcut)) clashes.push(`${page.id}/${row.id}: ${action.shortcut}`)
          seen.add(action.shortcut)
        }
      }
    }

    expect(clashes).toEqual([])
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
    // ⏎ edits the order in the window rather than leaving for /admin.
    expect(row.open).toMatchObject({ kind: 'form', form: 'order.status', recordId: 'o1' })
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
    prismaMock.product.findMany.mockResolvedValue([productFixture])

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
  it('opens a row in the edit sheet, filled in from the row it just read', async () => {
    prismaMock.customer.findMany.mockResolvedValue([customerFixture])

    const payload = await loadSection('customers')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.open).toMatchObject({
      kind: 'form',
      form: 'customer.edit',
      recordId: 'c1',
      // The sheet opens filled in without a second read, which is the whole
      // reason the loader carries values at all. No email: it is the key every
      // other system joins a customer on, so the edit form leaves it alone.
      values: { firstName: 'Vera', accountType: 'STANDARD' },
    })

    expect(
      (row.open as { values: Record<string, unknown> }).values.email,
      'the email is not editable, so the sheet should not carry it',
    ).toBeUndefined()
  })
})

describe('developer page', () => {
  it('shows the console overview and asks for the permission the console does', async () => {
    const { canSeePage } = await import('@/lib/admin-desktop/access')
    prismaMock.developerBlogPost.count.mockResolvedValue(3)

    const payload = await loadSection('database.developer')
    if (payload.body.view !== 'settings') throw new Error('expected a settings payload')

    const [status, platform] = payload.body.groups
    // The stubbed client has no $queryRaw, so the database check fails — and
    // says so rather than taking the page down.
    expect(status.rows.find((row) => row.label === 'Database')).toMatchObject({ value: 'Unreachable', tone: 'bad' })
    expect(platform.rows.find((row) => row.label === 'Developer blog posts')?.value).toBe('3')

    expect(canSeePage('database.developer', ['developer:database'])).toBe(false)
    expect(canSeePage('database.developer', ['developer:database', 'developer:system'])).toBe(true)
  })
})

describe('list window', () => {
  it('searches the database for every word on a list that outgrows its window', async () => {
    prismaMock.customer.findMany.mockResolvedValue([customerFixture])

    const payload = await loadSection('customers', undefined, { q: 'vera  smith', limit: 500 })

    const [args] = prismaMock.customer.findMany.mock.calls[0]
    expect(args.take).toBe(500)
    // Both words must match, each in any of the fields — "vera smith" finds
    // Vera Smith, not every Vera and every Smith.
    expect(args.where.AND).toHaveLength(2)
    expect(args.where.AND[0].OR).toContainEqual({ email: { contains: 'vera', mode: 'insensitive' } })
    expect(args.where.AND[1].OR).toContainEqual({ lastName: { contains: 'smith', mode: 'insensitive' } })
    expect(payload.list).toEqual({ q: 'vera  smith', limit: 500, more: false, searchable: true })
  })

  it('searches every field the row shows, so the database finds what the filter box would', async () => {
    // Audit rows hold only a user id; the Who column shows a name.
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'u7' }])
    await loadSection('audit', undefined, { q: 'mike', limit: 250 })
    const audit = prismaMock.auditLog.findMany.mock.calls[0][0].where.AND[0].OR
    expect(audit).toContainEqual({ userId: { in: ['u7'] } })

    // Orders: the Channel label and the state in Ship to.
    await loadSection('orders', undefined, { q: 'wholesale oh', limit: 250 })
    const [channel, state] = prismaMock.order.findMany.mock.calls[0][0].where.AND
    expect(channel.OR).toContainEqual({ salesChannel: 'WHOLESALE' })
    expect(JSON.stringify(state.OR)).toContain('"state":{"contains":"oh","mode":"insensitive"}')

    // Archives: a year.
    await loadSection('media.shows', undefined, { q: '2019', limit: 250 })
    expect(prismaMock.archivedShowSale.findMany.mock.calls[0][0].where.AND[0].OR).toContainEqual({ year: 2019 })
  })

  it('reads with no condition when there is nothing to search for', async () => {
    await loadSection('customers')
    expect(prismaMock.customer.findMany.mock.calls[0][0].where).toBeUndefined()
  })

  it('ignores q on a page that cannot search, and says the window is full', async () => {
    prismaMock.product.findMany.mockResolvedValue([productFixture, { ...productFixture, id: 'p4' }])

    const payload = await loadSection('products', undefined, { q: 'peach', limit: 2 })

    expect(prismaMock.product.findMany.mock.calls[0][0].take).toBe(2)
    expect(payload.list).toEqual({ q: '', limit: 2, more: true, searchable: false })
  })

  it('offers Mark shipped only on a paid order that has not gone out yet', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { ...orderFixture, id: 'paid', status: 'PROCESSING', adminNotes: 'gift wrap' },
      { ...orderFixture, id: 'unpaid', status: 'PROCESSING', paymentStatus: 'PENDING' },
      { ...orderFixture, id: 'gone', status: 'SHIPPED' },
    ])

    const payload = await loadSection('orders')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const shipped = (id: string) =>
      payload.body.view === 'table'
        ? payload.body.rows.find((row) => row.id === id)?.inspector.actions?.find((a) => a.label === 'Mark shipped')
        : undefined

    // The order's own notes travel with it, because the status handler writes
    // every field it is sent and would otherwise clear them.
    expect(shipped('paid')?.command).toMatchObject({
      kind: 'write',
      op: 'order.status',
      recordId: 'paid',
      values: { status: 'SHIPPED', paymentStatus: 'PAID', adminNotes: 'gift wrap' },
    })
    expect(shipped('unpaid')).toBeUndefined()
    expect(shipped('gone')).toBeUndefined()
  })
})

describe('events', () => {
  it('opens a show in the edit sheet with its dates as date-input strings', async () => {
    prismaMock.featuredEvent.findMany.mockResolvedValue([eventFixture])

    const payload = await loadSection('events')
    if (payload.body.view !== 'events') throw new Error('expected an events payload')

    const [row] = payload.body.rows
    expect(row.open).toMatchObject({
      kind: 'form',
      form: 'event.edit',
      recordId: 'e1',
      // Midday UTC formats as the 20th in Ohio, which is the day of the show.
      values: { title: 'Zanesville Harvest Festival', startDate: '2026-09-20', state: 'OH' },
    })
  })
})

describe('every command the desktop shell can run', () => {
  // A command is the only way anything happens in the window, so one naming a
  // form, a handler, a section or a page that does not exist is a dead button.
  it('has a route table to check the remaining hand-offs against', () => {
    expect(ADMIN_ROUTES).toContain('/admin/customers')
    expect(ADMIN_ROUTES).toContain('/admin/events/[id]/edit')
    // The customer account page exists now; the events detail route still does not.
    expect(ADMIN_ROUTES).toContain('/admin/customers/[id]')
    expect(ADMIN_ROUTES).not.toContain('/admin/events/[id]')
  })

  it('resolves every header action and page path on every page', async () => {
    const broken: string[] = []

    for (const { page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)

      for (const action of payload.actions) {
        const fault = commandFault(action.command)
        if (fault) broken.push(`${page.id}: action "${action.label}" — ${fault}`)
      }
      if (!isRealAdminRoute(payload.path)) broken.push(`${page.id}: page path → ${payload.path}`)
      if (payload.body.view === 'link') {
        for (const view of payload.body.views) {
          if (!isRealAdminRoute(view.path)) broken.push(`${page.id}: view "${view.label}" → ${view.path}`)
        }
      }
    }

    expect(broken).toEqual([])
  })

  it('resolves every command a populated section puts on a row', async () => {
    prismaMock.order.findMany.mockResolvedValue([orderFixture])
    prismaMock.product.findMany.mockResolvedValue([productFixture])
    prismaMock.customer.findMany.mockResolvedValue([customerFixture])
    prismaMock.featuredEvent.findMany.mockResolvedValue([eventFixture])
    // One reward nobody has redeemed (so Delete is offered) and one that has.
    prismaMock.loyaltyReward.findMany.mockResolvedValue([
      rewardFixture,
      { ...rewardFixture, id: 'reward-2', usedCount: 3, _count: { redemptions: 3 } },
    ])

    const broken: string[] = []

    for (const { page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
      const rows = payload.body.view === 'table' || payload.body.view === 'events' ? payload.body.rows : []

      for (const row of rows) {
        const fault = commandFault(row.open)
        if (fault) broken.push(`${page.id}: row ${row.id} — ${fault}`)

        for (const action of row.inspector.actions ?? []) {
          const actionFault = commandFault(action.command)
          if (actionFault) broken.push(`${page.id}: row ${row.id} "${action.label}" — ${actionFault}`)
        }
      }

      if (payload.body.view === 'table' || payload.body.view === 'events') {
        for (const action of payload.body.rows.flatMap((row) => row.inspector.actions ?? [])) {
          if (action.shortcut) expect(isBindableShortcut(action.shortcut)).toBe(true)
        }
      }

      if (payload.body.view === 'dashboard') {
        for (const order of payload.body.todayOrders) {
          const fault = commandFault(order.open)
          if (fault) broken.push(`dashboard: order ${order.id} — ${fault}`)
        }
        for (const item of payload.body.lowStock) {
          const fault = commandFault(item.open)
          if (fault) broken.push(`dashboard: low stock ${item.name} — ${fault}`)
        }
      }

      if (payload.body.view === 'settings') {
        for (const group of payload.body.groups) {
          const fault = commandFault(group.edit)
          if (fault) broken.push(`settings: group ${group.label} — ${fault}`)
        }
      }
    }

    expect(broken).toEqual([])
  })

  it('never opens a create sheet with a record id attached', async () => {
    // A create carrying a record id would update that record instead, which the
    // sheet has no way to show and the operator has no way to notice.
    const wrong: string[] = []

    for (const { page } of DESKTOP_PAGES) {
      const payload = await loadSection(page.id)
      for (const action of payload.actions) {
        if (action.command.kind !== 'form') continue
        if (action.command.form.endsWith('.create') && action.command.recordId) {
          wrong.push(`${page.id}: "${action.label}"`)
        }
      }
    }

    expect(wrong).toEqual([])
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

    // A live transcript is a stream, so it is one of the few things still
    // handed off; the shell only edits the thread's status in place.
    expect(payload.body.rows[0].open).toMatchObject({ kind: 'form', form: 'chat.edit', recordId: 't9' })
    expect(payload.body.rows[0].inspector.actions?.[0].command).toEqual({
      kind: 'open',
      href: '/admin/messages/live/t9',
    })
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
    expect(payload.body.rows[0].open).toMatchObject({ kind: 'form', form: 'post.edit', recordId: 'b1' })
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

describe('returns', () => {
  it('values a return from the line it came from, not the whole order', async () => {
    // A partial return of a multi-line order is the common case; taking the
    // order total would overstate every RMA on the page.
    prismaMock.returnRequest.findMany.mockResolvedValue([
      {
        id: 'r1',
        rmaNumber: 'RMA-1042',
        status: 'APPROVED',
        reason: 'DAMAGED',
        resolution: 'REFUND',
        restockingFee: null,
        adminNote: null,
        approvedAt: new Date('2026-09-12T12:00:00Z'),
        receivedAt: null,
        completedAt: null,
        createdAt: new Date('2026-09-10T12:00:00Z'),
        items: [
          { id: 'ri1', quantity: 2, orderItem: { productName: 'Black Bean', unitPrice: 9.5 } },
          { id: 'ri2', quantity: 1, orderItem: { productName: 'Peach', unitPrice: 9.5 } },
        ],
        order: {
          id: 'o1',
          orderNumber: 'JMS-24817',
          total: 214,
          guestEmail: null,
          user: { name: 'Vera Okonkwo', email: 'vera@example.com' },
          shippingAddress: { firstName: 'Vera', lastName: 'Okonkwo' },
        },
      },
    ])

    const payload = await loadSection('orders.returns')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[5].text).toBe('3')
    expect(row.cells[6].text).toBe('$28.50')
    // Approved but not yet received: the next step is the only one offered.
    const labels = (row.inspector.actions ?? []).map((action) => action.label)
    expect(labels).toContain('Mark received')
    expect(labels).not.toContain('Approve')
    expect(labels).not.toContain('Complete')
  })
})

describe('packing manifests', () => {
  it('reads a manifest in jars, folding cases in at twelve to the case', async () => {
    prismaMock.eventManifest.findMany.mockResolvedValue([
      {
        id: 'm1',
        status: 'RETURNED',
        packedAt: new Date('2026-09-18T12:00:00Z'),
        returnedAt: new Date('2026-09-21T12:00:00Z'),
        notes: null,
        event: {
          id: 'e1',
          title: 'Zanesville Harvest Festival',
          startDate: new Date('2026-09-20T12:00:00Z'),
          city: 'Zanesville',
          state: 'OH',
        },
        items: [
          {
            id: 'mi1',
            takenCases: 4,
            takenJars: 3,
            returnedCases: 1,
            returnedJars: 0,
            product: { name: 'Black Bean', price: 10 },
          },
        ],
      },
    ])

    const payload = await loadSection('events.manifests')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[4].text).toBe('51')
    expect(row.cells[5].text).toBe('12')
    expect(row.cells[6].text).toBe('39')
  })
})

describe('battle arena', () => {
  it('reports gross sales against the goal, and the split beside it', async () => {
    // A fundraiser goal is stated in what the group sold, not in the half it
    // keeps — reporting commission against the goal would halve every board.
    prismaMock.fundraiserTeam.findMany.mockResolvedValue([
      {
        id: 't1',
        slug: 'zanesville-track',
        name: 'Zanesville Track',
        school: 'Zanesville High',
        activePeriod: '2026 Spring',
        status: 'ACTIVE',
        goalAmount: 2000,
        salesCount: 3,
        hpCurrent: 40,
        contactName: 'Coach Diaz',
        contactEmail: 'diaz@example.com',
        tagline: null,
        saleEvents: [
          { amount: 400, createdAt: new Date('2026-09-01T12:00:00Z') },
          { amount: 600, createdAt: new Date('2026-09-05T12:00:00Z') },
        ],
        season: { period: '2026 Spring' },
        _count: { shields: 2, shareEvents: 9, characters: 4 },
      },
    ])

    const payload = await loadSection('fundraisers.arena')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[3].text).toBe('$1,000.00')
    expect(row.cells[5].text).toBe('50%')

    const board = row.inspector.groups.find((group) => group.label === 'SCOREBOARD')
    expect(board?.fields?.find((field) => field.label === 'Gross sales')?.value).toBe('$1,000.00')
    expect(board?.fields?.find((field) => field.label === 'To the group')?.value).toBe('$500.00')
  })
})

describe('reconciliation', () => {
  it('files a late-December evening entry in the year it happened in Ohio', async () => {
    // Vercel runs functions with TZ=UTC, so 8pm on 31 December in Zanesville is
    // 1 January in UTC — and would land in the following tax year.
    prismaMock.ledgerEntry.findMany.mockResolvedValue([
      { date: new Date('2026-01-01T01:00:00Z'), amountCents: 50_000 },
      { date: new Date('2026-06-15T16:00:00Z'), amountCents: 25_000 },
    ])

    const payload = await loadSection('ledger.reconciliation')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const years = payload.body.rows.map((row) => row.id)
    expect(years).toContain('2025')
    expect(years).toContain('2026')

    const twentyFive = payload.body.rows.find((row) => row.id === '2025')
    expect(twentyFive?.cells[1].text).toBe('$500.00')
  })
})

describe('suppressions', () => {
  it('counts the bounces behind an address rather than only that it is blocked', async () => {
    prismaMock.emailSuppression.findMany.mockResolvedValue([
      {
        id: 's1',
        email: 'bounced@example.com',
        reason: 'HARD_BOUNCE',
        source: 'resend',
        notes: null,
        createdAt: new Date('2026-08-01T12:00:00Z'),
        updatedAt: new Date('2026-08-01T12:00:00Z'),
      },
    ])
    prismaMock.emailBounce.findMany.mockResolvedValue([
      {
        email: 'Bounced@example.com',
        bounceType: 'HARD',
        reason: 'mailbox does not exist',
        recordedAt: new Date('2026-07-30T12:00:00Z'),
      },
      {
        email: 'bounced@example.com',
        bounceType: 'SOFT',
        reason: 'mailbox full',
        recordedAt: new Date('2026-07-28T12:00:00Z'),
      },
    ])

    const payload = await loadSection('email.suppressions')
    if (payload.body.view !== 'table') throw new Error('expected a table payload')

    const [row] = payload.body.rows
    expect(row.cells[3].text).toBe('2')

    const history = row.inspector.groups.find((group) => group.label === 'BOUNCE HISTORY')
    expect(history?.fields?.find((field) => field.label === 'Hard bounces')?.value).toBe('1')
    expect(history?.fields?.find((field) => field.label === 'Soft bounces')?.value).toBe('1')
  })
})

describe('the credential vault page', () => {
  it('never asks the database for the encrypted value', async () => {
    prismaMock.serviceCredential.findMany.mockResolvedValue([])

    await loadSection('users.credentials')

    const [args] = prismaMock.serviceCredential.findMany.mock.calls[0]
    const selected = Object.keys(args.select)
    for (const secret of ['encValue', 'encIv', 'encTag']) {
      expect(selected, `the vault page selected ${secret}`).not.toContain(secret)
    }
  })
})

describe('customers · loyalty rewards', () => {
  it('shows what each reward gives back and only offers Delete when nobody redeemed it', async () => {
    prismaMock.loyaltyReward.findMany.mockResolvedValue([
      rewardFixture,
      { ...rewardFixture, id: 'reward-2', usedCount: 3, _count: { redemptions: 3 } },
    ])

    const payload = await loadSection('customers.rewards')
    expect(payload.heading).toBe('Loyalty rewards')
    if (payload.body.view !== 'table') throw new Error('expected a table')

    const [fresh, redeemed] = payload.body.rows
    // 500 points = $50 spent at 10 points/$1; $5 back is 10%.
    expect(fresh.cells[3].text).toBe('10.0%')
    expect(fresh.inspector.actions?.some((a) => a.label === 'Delete reward')).toBe(true)
    expect(redeemed.inspector.actions?.some((a) => a.label === 'Delete reward')).toBe(false)
    expect(fresh.open).toMatchObject({ kind: 'form', form: 'reward.edit', recordId: 'reward-1' })
  })

  it('flags a legacy reward checkout cannot honour', async () => {
    prismaMock.loyaltyReward.findMany.mockResolvedValue([{ ...rewardFixture, rewardType: 'FREE_SHIPPING' }])
    const payload = await loadSection('customers.rewards')
    if (payload.body.view !== 'table') throw new Error('expected a table')
    expect(payload.body.rows[0].cells.at(-1)?.text).toBe('Not redeemable')
  })
})
