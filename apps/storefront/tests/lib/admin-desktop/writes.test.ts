import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The write layer, against a stubbed Prisma client.
 *
 * What is worth pinning here is not that Prisma writes — it is the handful of
 * decisions the handlers make on the operator's behalf: what a date input means
 * in Ohio, which rows refuse to be edited or deleted, and that every operation
 * carries a permission at all.
 */

const prismaMock = {
  $transaction: vi.fn(),
  blogPost: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  customer: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  emailCampaign: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  featuredEvent: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  fundraiser: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  fundraiserParticipant: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  invoice: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  ledgerEntry: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  order: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  product: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  purchaseOrder: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  review: { update: vi.fn(), delete: vi.fn() },
  seoConfiguration: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  storeSettings: { upsert: vi.fn() },
  user: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  socialMediaPost: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  notification: { updateMany: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }))

const adjustInventory = vi.fn()
/** Mirrors the real one closely enough that the handler's message survives. */
class StaleInventoryError extends Error {
  constructor(expected: number, actual: number) {
    super(`Stock moved while this was being edited (expected ${expected} on hand, found ${actual}).`)
    this.name = 'StaleInventoryError'
  }
}
vi.mock('@/lib/inventory-manager', () => ({ adjustInventory, StaleInventoryError }))
vi.mock('@/lib/orders/events', () => ({ emitOrderCreated: vi.fn() }))

const insertRecipientsFromList = vi.fn()
vi.mock('@/lib/email/recipients', () => ({ insertRecipientsFromList }))

const creditFundraiserCommission = vi.fn(async () => ({ credited: false, amount: 0 }))
const creditPurchaseLoyaltyPoints = vi.fn(async () => ({ awarded: false, points: 0 }))
vi.mock('@/lib/fundraising/credit-commission', () => ({ creditFundraiserCommission }))
vi.mock('@/lib/loyalty', () => ({ creditPurchaseLoyaltyPoints }))

const recordFulfillmentEvent = vi.fn()
vi.mock('@/lib/orders/fulfillment', () => ({
  buildFulfillmentUpdate: vi.fn(() => ({ fulfillmentStatus: 'FULFILLED' })),
  fulfillEntireOrder: vi.fn(),
  isDerivedTransition: vi.fn(() => false),
  recordFulfillmentEvent,
  transitionForOrderStatus: vi.fn((status: string) => (status === 'SHIPPED' ? 'shipped' : null)),
}))

vi.mock('@/lib/developer/constants', () => ({
  canEraseData: (email: string) => email === 'owner@josemadridsalsa.com',
}))

const { WRITE_HANDLERS, findWriteHandler, redactForAudit, WriteError } = await import(
  '@/lib/admin-desktop/writes'
)
const { DESKTOP_FORMS, DIRECT_OPS } = await import('@/lib/admin-desktop/forms')
const { permissionDefinitions } = await import('@/lib/permissions-data')

/**
 * A context standing in for the route's. `can` answers yes by default so a test
 * about something else is not also a test about permissions; the cases that care
 * pass their own.
 */
const actor = {
  actor: { id: 'u1', email: 'mike@josemadridsalsa.com', role: 'ADMIN' },
  can: async () => true,
}

/** The same, for an actor who holds nothing beyond the handler's own permission. */
const withoutExtraPermissions = {
  actor: { id: 'u1', email: 'mike@josemadridsalsa.com', role: 'ADMIN' },
  can: async () => false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the handler registry', () => {
  it('has a handler for every form the shell can open', () => {
    // A sheet with no handler behind it collects a record and then 400s on save.
    for (const id of Object.keys(DESKTOP_FORMS)) {
      expect(findWriteHandler(id), `${id} has no handler`).toBeDefined()
    }
  })

  it('has a handler for every direct operation', () => {
    for (const op of DIRECT_OPS) {
      expect(findWriteHandler(op), `${op} has no handler`).toBeDefined()
    }
  })

  it('names a permission that actually exists, or says staff-only on purpose', () => {
    // A typo'd permission name is not a locked door — `hasPermission` simply
    // never finds it, so the operation is refused for everyone including the
    // developer account, and looks like a bug rather than a policy.
    const known = new Set(permissionDefinitions.map((permission) => permission.name))

    for (const [op, handler] of Object.entries(WRITE_HANDLERS)) {
      if (handler.permission === null) continue
      expect(known.has(handler.permission), `${op} wants unknown permission ${handler.permission}`).toBe(true)
    }
  })

  /**
   * The operations that deliberately act without a selected row.
   *
   * Anything not named here and not a `settings.` singleton must require a
   * record, or it writes somewhere random. Kept as an explicit list so adding a
   * bulk write is a decision somebody made rather than something that slipped
   * through: every entry is scoped by the actor or by a `where` that names the
   * whole set on purpose.
   */
  const BULK_OPS = new Set(['notification.markAllRead'])

  it('requires a record for every update and delete', () => {
    for (const [op, handler] of Object.entries(WRITE_HANDLERS)) {
      if (handler.action === 'create') continue
      // Settings are the one singleton: there is nothing to select.
      if (op.startsWith('settings.')) continue
      if (BULK_OPS.has(op)) continue
      expect(handler.requiresRecord, `${op} would act on nothing`).toBe(true)
    }
  })

  it('scopes every bulk write to the person running it', async () => {
    // A bulk write has no row to check, so the only thing standing between it
    // and everybody else's records is its own `where`. Marking one account's
    // notifications read must leave another account's alone.
    const mine = { id: 'user-1', email: 'mine@example.com' }
    for (const op of BULK_OPS) {
      const handler = WRITE_HANDLERS[op]
      expect(handler, `${op} is not registered`).toBeDefined()
      prismaMock.notification.updateMany.mockResolvedValue({ count: 2 })
      prismaMock.notification.updateMany.mockClear()
      await handler.execute({}, { actor: { ...mine, role: 'ADMIN' }, can: async () => true })
      const calls = prismaMock.notification.updateMany.mock.calls
      expect(calls.length, `${op} wrote nothing`).toBeGreaterThan(0)
      for (const [args] of calls) {
        expect(args.where.userId, `${op} is not scoped to the actor`).toBe(mine.id)
      }
    }
  })

  it('refuses an update with no record rather than writing somewhere random', async () => {
    await expect(WRITE_HANDLERS['product.toggleActive'].execute({}, { ...actor })).rejects.toBeInstanceOf(
      WriteError,
    )
  })
})

describe('dates', () => {
  it('reads a date input as the day it is in Ohio, not the evening before', async () => {
    // `new Date('2026-09-20')` is midnight UTC, which is 8pm on the 19th in
    // Zanesville — a show entered for the 20th would read as the 19th
    // everywhere the shell formats in store time.
    prismaMock.featuredEvent.create.mockResolvedValue({ id: 'e1', title: 'Harvest' })

    await WRITE_HANDLERS['event.create'].execute(
      {
        title: 'Harvest',
        startDate: '2026-09-20',
        bookingStatus: 'CONFIRMED',
        isWhereIsJose: true,
      },
      { ...actor },
    )

    const { startDate } = prismaMock.featuredEvent.create.mock.calls[0][0].data
    expect(startDate.toISOString()).toBe('2026-09-20T12:00:00.000Z')
    expect(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(startDate),
    ).toBe('2026-09-20')
  })

  it('keeps an instant from a datetime field exactly as it was sent', async () => {
    prismaMock.emailCampaign.create.mockResolvedValue({ id: 'c1', name: 'Autumn' })
    insertRecipientsFromList.mockResolvedValue(12)

    await WRITE_HANDLERS['campaign.create'].execute(
      {
        name: 'Autumn',
        subject: 'Autumn heat',
        templateId: 't1',
        listId: 'list-1',
        scheduledAt: '2026-10-01T14:30:00.000Z',
        trackOpens: true,
        trackClicks: true,
      },
      { ...actor },
    )

    const { scheduledAt, status } = prismaMock.emailCampaign.create.mock.calls[0][0].data
    expect(scheduledAt.toISOString()).toBe('2026-10-01T14:30:00.000Z')
    // It is written as a draft first and only becomes SCHEDULED once its
    // recipients exist — see the campaign cases below.
    expect(status).toBe('DRAFT')
  })

  it('leaves an empty optional date null instead of inventing 1970', async () => {
    prismaMock.featuredEvent.create.mockResolvedValue({ id: 'e2', title: 'Maybe' })

    await WRITE_HANDLERS['event.create'].execute(
      { title: 'Maybe', startDate: '2026-09-20', bookingStatus: 'INTERESTED', isWhereIsJose: false },
      { ...actor },
    )

    expect(prismaMock.featuredEvent.create.mock.calls[0][0].data.endDate).toBeNull()
  })
})

describe('validation', () => {
  it('refuses a fundraiser that ends before it starts', async () => {
    await expect(
      WRITE_HANDLERS['fundraiser.create'].execute(
        {
          name: 'Backwards',
          slug: 'backwards',
          organizationName: 'Ridgewood',
          contactEmail: 'coach@example.com',
          startDate: '2026-10-01',
          endDate: '2026-09-01',
          commissionRate: 50,
          defaultUnitPrice: 10,
          status: 'DRAFT',
          fulfillmentMethod: 'ORDER_FORMS_AND_BULK',
          isActive: false,
        },
        { ...actor },
      ),
    ).rejects.toThrow(/after the start date/)
    expect(prismaMock.fundraiser.create).not.toHaveBeenCalled()
  })

  it('refuses a slug the database would reject', async () => {
    await expect(
      WRITE_HANDLERS['product.create'].execute(
        {
          name: 'Peach',
          slug: 'Peach Salsa!',
          sku: 'JMS-PCH-16',
          categoryId: 'cat1',
          heatLevel: 'FRUIT',
          price: 11.95,
          isActive: true,
          isFeatured: false,
        },
        { ...actor },
      ),
    ).rejects.toThrow(/Lowercase letters/)
  })

  it('measures the SEO budget against what Google would actually show', async () => {
    // A blank SEO title means the article's own title is the one that gets
    // rendered, so that is the string the budget applies to.
    await expect(
      WRITE_HANDLERS['post.create'].execute(
        {
          title: 'A very long title that runs well past the sixty character budget Google allows',
          slug: 'long-title',
          excerpt: 'Short enough.',
          content: 'Body.',
          status: 'PUBLISHED',
          layout: 'STANDARD',
          featured: false,
        },
        { ...actor },
      ),
    ).rejects.toThrow(/truncated in search results/)
  })

  it('holds a public post to the minimum title length too, not just the maximum', async () => {
    // `lib/blog/schemas.ts` has both ends of the budget: a 21-character title
    // wastes the snippet exactly as a 70-character one is truncated. Checking
    // only the maximum let a post go public in a state /admin/blog refuses.
    await expect(
      WRITE_HANDLERS['post.create'].execute(
        {
          title: 'Too short',
          slug: 'too-short',
          excerpt: 'Short enough.',
          content: 'Body.',
          status: 'PUBLISHED',
          layout: 'STANDARD',
          featured: false,
        },
        { ...actor },
      ),
    ).rejects.toThrow(/wastes search snippet space/)
  })

  it('lets a draft be saved while it is still being written', async () => {
    // The rules bite on publish and schedule, not while the title is a stub.
    prismaMock.blogPost.create.mockResolvedValue({ id: 'b1', title: 'Wip', slug: 'wip' })

    await WRITE_HANDLERS['post.create'].execute(
      {
        title: 'Wip',
        slug: 'wip',
        excerpt: 'Short enough.',
        content: 'Body.',
        status: 'DRAFT',
        layout: 'STANDARD',
        featured: false,
      },
      { ...actor },
    )

    expect(prismaMock.blogPost.create).toHaveBeenCalled()
  })

  it('turns a unique-constraint collision into something the operator can fix', async () => {
    const { Prisma } = await import('@prisma/client')
    prismaMock.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['sku'] },
      }),
    )

    await expect(
      WRITE_HANDLERS['product.create'].execute(
        {
          name: 'Peach',
          slug: 'peach',
          sku: 'JMS-PCH-16',
          categoryId: 'cat1',
          heatLevel: 'FRUIT',
          price: 11.95,
          isActive: true,
          isFeatured: false,
        },
        { ...actor },
      ),
    ).rejects.toThrow(/already uses that sku/)
  })
})

describe('rows that refuse to change', () => {
  it('will not edit a ledger row derived from another record', async () => {
    prismaMock.ledgerEntry.findUnique.mockResolvedValue({ isManual: false })

    await expect(
      WRITE_HANDLERS['ledger.edit'].execute(
        {
          date: '2026-09-01',
          direction: 'INCOME',
          amount: 10,
          category: 'PRODUCT_SALES',
          description: 'Order JMS-1',
        },
        { ...actor, recordId: 'l1' },
      ),
    ).rejects.toThrow(/Edit the record it came from/)
    expect(prismaMock.ledgerEntry.update).not.toHaveBeenCalled()
  })

  it('will not delete a derived ledger row either', async () => {
    prismaMock.ledgerEntry.findUnique.mockResolvedValue({ isManual: false, description: 'Order JMS-1' })

    await expect(
      WRITE_HANDLERS['ledger.delete'].execute({}, { ...actor, recordId: 'l1' }),
    ).rejects.toThrow(/hand-entered/)
  })

  it('retires a product that has been sold instead of deleting its order lines', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Peach', _count: { orderItems: 4 } })

    const outcome = await WRITE_HANDLERS['product.delete'].execute({}, { ...actor, recordId: 'p1' })

    expect(prismaMock.product.delete).not.toHaveBeenCalled()
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isActive: false },
    })
    expect(outcome.message).toMatch(/retired/)
  })

  it('deletes a product that has never been sold', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Test Batch', _count: { orderItems: 0 } })
    prismaMock.product.delete.mockResolvedValue({})

    await WRITE_HANDLERS['product.delete'].execute({}, { ...actor, recordId: 'p2' })
    expect(prismaMock.product.delete).toHaveBeenCalledWith({ where: { id: 'p2' } })
  })

  it('keeps a campaign with orders against it rather than deleting the history', async () => {
    prismaMock.fundraiser.findUnique.mockResolvedValue({ name: 'Ridgewood', _count: { orders: 12 } })

    await expect(
      WRITE_HANDLERS['fundraiser.delete'].execute({}, { ...actor, recordId: 'f1' }),
    ).rejects.toThrow(/Cancel it instead/)
  })

  it('will not let an operator delete the account they are signed in with', async () => {
    await expect(
      WRITE_HANDLERS['user.delete'].execute({}, { ...actor, recordId: 'u1' }),
    ).rejects.toThrow(/signed in with/)
  })

  it('will not edit a campaign that has already gone out', async () => {
    prismaMock.emailCampaign.findUnique.mockResolvedValue({ status: 'SENT' })

    await expect(
      WRITE_HANDLERS['campaign.edit'].execute(
        { name: 'Autumn', subject: 'Autumn heat', templateId: 't1', trackOpens: true, trackClicks: true },
        { ...actor, recordId: 'c1' },
      ),
    ).rejects.toThrow(/Duplicate it instead/)
  })
})

describe('stock adjustment', () => {
  it('turns "set the count to" into the delta that gets there', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Peach', inventory: 40 })

    const outcome = await WRITE_HANDLERS['inventory.adjust'].execute(
      { mode: 'SET', amount: 55, reason: 'Count correction' },
      { ...actor, recordId: 'p1' },
    )

    expect(adjustInventory).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'p1', quantity: 15, type: 'ADJUSTMENT', reason: 'Count correction' }),
    )
    expect(outcome.message).toContain('55 on hand')
  })

  it('passes a delta straight through', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Peach', inventory: 40 })

    await WRITE_HANDLERS['inventory.adjust'].execute(
      { mode: 'DELTA', amount: -6, reason: 'Breakage' },
      { ...actor, recordId: 'p1' },
    )

    expect(adjustInventory).toHaveBeenCalledWith(expect.objectContaining({ quantity: -6 }))
  })

  it('does nothing when the count is already right', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Peach', inventory: 40 })

    await WRITE_HANDLERS['inventory.adjust'].execute(
      { mode: 'SET', amount: 40, reason: 'Count correction' },
      { ...actor, recordId: 'p1' },
    )

    expect(adjustInventory).not.toHaveBeenCalled()
  })

  it('reports the inventory manager’s own refusal rather than a generic failure', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Peach', inventory: 2 })
    adjustInventory.mockRejectedValue(new Error('Insufficient inventory for Peach (SKU: JMS-PCH-16)'))

    await expect(
      WRITE_HANDLERS['inventory.adjust'].execute(
        { mode: 'DELTA', amount: -10, reason: 'Breakage' },
        { ...actor, recordId: 'p1' },
      ),
    ).rejects.toThrow(/Insufficient inventory/)
  })
})

describe('invoices', () => {
  it('derives the total from the lines rather than trusting a typed figure', async () => {
    prismaMock.invoice.create.mockResolvedValue({ id: 'i1', number: 'INV-1' })

    await WRITE_HANDLERS['invoice.create'].execute(
      {
        dueDate: '2026-10-15',
        status: 'DRAFT',
        lines: [
          { description: 'Cases of Peach', quantity: 4, unitPrice: 42.5 },
          { description: 'Freight', quantity: 1, unitPrice: 18 },
        ],
      },
      { ...actor },
    )

    const { total, lines } = prismaMock.invoice.create.mock.calls[0][0].data
    expect(Number(total)).toBe(188)
    expect(lines[0]).toEqual({ description: 'Cases of Peach', quantity: 4, unitPrice: 42.5, amount: 170 })
  })

  it('refuses an invoice with no lines', async () => {
    await expect(
      WRITE_HANDLERS['invoice.create'].execute({ dueDate: '2026-10-15', status: 'DRAFT', lines: [] }, { ...actor }),
    ).rejects.toThrow(/at least one line/)
  })
})

describe('receiving a purchase order', () => {
  it('puts every outstanding unit into stock and closes the PO', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      poNumber: 'PO-20260901-1234',
      status: 'SUBMITTED',
      items: [
        { id: 'i1', productId: 'p1', quantityOrdered: 24, quantityReceived: 0 },
        { id: 'i2', productId: 'p2', quantityOrdered: 12, quantityReceived: 12 },
      ],
    })
    prismaMock.$transaction.mockImplementation(async (run: (tx: unknown) => Promise<void>) =>
      run({
        purchaseOrderReceipt: { create: vi.fn() },
        purchaseOrderItem: { update: vi.fn() },
        purchaseOrder: { update: vi.fn() },
      }),
    )

    const outcome = await WRITE_HANDLERS['purchase.receive'].execute({}, { ...actor, recordId: 'po1' })

    // Only the line with something still outstanding moves stock.
    expect(adjustInventory).toHaveBeenCalledTimes(1)
    expect(adjustInventory).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'p1', quantity: 24, type: 'RESTOCK', purchaseOrderId: 'po1' }),
    )
    expect(outcome.message).toContain('24 unit(s)')
  })

  it('refuses to receive a PO twice', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      poNumber: 'PO-1',
      status: 'RECEIVED',
      items: [],
    })

    await expect(
      WRITE_HANDLERS['purchase.receive'].execute({}, { ...actor, recordId: 'po1' }),
    ).rejects.toThrow(/already been received/)
    expect(adjustInventory).not.toHaveBeenCalled()
  })
})

describe('the ledger', () => {
  it('stores money as positive cents and lets the direction carry the sign', async () => {
    prismaMock.ledgerEntry.create.mockResolvedValue({ id: 'l1', description: 'Booth fee' })

    await WRITE_HANDLERS['ledger.create'].execute(
      {
        date: '2026-09-20',
        direction: 'EXPENSE',
        amount: 120.5,
        category: 'BOOTH_FEE',
        description: 'Booth fee',
      },
      { ...actor },
    )

    const data = prismaMock.ledgerEntry.create.mock.calls[0][0].data
    expect(data.amountCents).toBe(12050)
    expect(data.direction).toBe('EXPENSE')
    // Marked by hand so the backfill leaves it alone.
    expect(data.isManual).toBe(true)
    expect(data.source).toBe('MANUAL')
    expect(data.enteredById).toBe('u1')
  })

  it('refuses a negative amount instead of flipping the direction behind the operator', async () => {
    await expect(
      WRITE_HANDLERS['ledger.create'].execute(
        {
          date: '2026-09-20',
          direction: 'EXPENSE',
          amount: -120,
          category: 'BOOTH_FEE',
          description: 'Booth fee',
        },
        { ...actor },
      ),
    ).rejects.toThrow(/always positive/)
  })
})

describe('publishing a post', () => {
  it('hands the Search Console step back to the person doing it', async () => {
    // No agent has Search Console access, so URL Inspection is always a handoff.
    prismaMock.blogPost.update.mockResolvedValue({ title: 'Small batch', slug: 'small-batch' })

    const outcome = await WRITE_HANDLERS['post.publish'].execute({}, { ...actor, recordId: 'b1' })
    expect(outcome.message).toMatch(/URL Inspection/)
  })
})

describe('participants', () => {
  it('builds a referral code from the name when none is given', async () => {
    prismaMock.fundraiserParticipant.create.mockResolvedValue({
      id: 'fp1',
      name: 'Dana Reyes',
      referralCode: 'dana-reyes-ab12',
    })

    await WRITE_HANDLERS['participant.create'].execute(
      { fundraiserId: 'f1', name: 'Dana Reyes', email: 'DANA@example.com' },
      { ...actor },
    )

    const data = prismaMock.fundraiserParticipant.create.mock.calls[0][0].data
    expect(data.referralCode).toMatch(/^dana-reyes-[a-z0-9]{4}$/)
    // Emails are stored folded so a second sign-up does not read as a new person.
    expect(data.email).toBe('dana@example.com')
  })

  it('keeps a participant who has sales against them', async () => {
    prismaMock.fundraiserParticipant.findUnique.mockResolvedValue({
      name: 'Dana Reyes',
      _count: { orders: 3 },
    })

    await expect(
      WRITE_HANDLERS['participant.delete'].execute({}, { ...actor, recordId: 'fp1' }),
    ).rejects.toThrow(/inactive instead/)
  })
})

describe('the gates a permission alone does not cover', () => {
  it('refuses to hand out DEVELOPER to anyone who is not one', async () => {
    // `users:write` is enough to edit staff; it is not enough to mint a super
    // admin. Without this an account that could edit users could promote itself.
    await expect(
      WRITE_HANDLERS['user.create'].execute(
        { name: 'Pat', email: 'pat@example.com', password: 'longenough', role: 'DEVELOPER' },
        { ...actor },
      ),
    ).rejects.toThrow(/Only a developer can assign/)

    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('lets a developer assign the role', async () => {
    prismaMock.user.create.mockResolvedValue({ id: 'u9', email: 'pat@example.com' })

    await WRITE_HANDLERS['user.create'].execute(
      { name: 'Pat', email: 'pat@example.com', password: 'longenough', role: 'DEVELOPER' },
      { ...actor, actor: { ...actor.actor, role: 'DEVELOPER' } },
    )

    expect(prismaMock.user.create).toHaveBeenCalled()
  })

  it('refuses to edit an existing DEVELOPER account from a lesser role', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'DEVELOPER' })

    await expect(
      WRITE_HANDLERS['user.edit'].execute(
        {
          name: 'Pat',
          email: 'pat@example.com',
          role: 'ADMIN',
          isEmailVerified: true,
        },
        { ...actor, recordId: 'u9' },
      ),
    ).rejects.toThrow(/Only a developer can modify/)
  })

  it('keeps user deletion behind the owner account, not behind users:write', async () => {
    // Deleting a user cascades through everything they own, which is why the
    // canonical DELETE route asks for the owner rather than the permission.
    await expect(
      WRITE_HANDLERS['user.delete'].execute({}, { ...actor, recordId: 'u9' }),
    ).rejects.toThrow(/Only an owner account/)

    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('lets the owner delete a non-developer account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'STAFF' })
    prismaMock.user.delete.mockResolvedValue({ email: 'pat@example.com' })

    await WRITE_HANDLERS['user.delete'].execute({}, {
      ...actor,
      actor: { ...actor.actor, email: 'owner@josemadridsalsa.com' },
      recordId: 'u9',
    })

    expect(prismaMock.user.delete).toHaveBeenCalled()
  })

  it('needs scheduling permission to queue a social post, not just compose', async () => {
    await expect(
      WRITE_HANDLERS['social.create'].execute(
        {
          content: 'New batch',
          platforms: ['FACEBOOK'],
          status: 'SCHEDULED',
          scheduledAt: '2026-10-01T14:30:00.000Z',
          hashtags: [],
        },
        { ...withoutExtraPermissions },
      ),
    ).rejects.toThrow(/scheduling permission/)
  })

  it('needs publishing permission to record a post as live', async () => {
    await expect(
      WRITE_HANDLERS['social.create'].execute(
        { content: 'New batch', platforms: ['FACEBOOK'], status: 'PUBLISHED', hashtags: [] },
        { ...withoutExtraPermissions },
      ),
    ).rejects.toThrow(/publishing permission/)
  })

  it('still lets a composer save a draft', async () => {
    prismaMock.socialMediaPost.create.mockResolvedValue({ id: 's1' })

    await WRITE_HANDLERS['social.create'].execute(
      { content: 'New batch', platforms: ['FACEBOOK'], status: 'DRAFT', hashtags: [] },
      { ...withoutExtraPermissions },
    )

    expect(prismaMock.socialMediaPost.create).toHaveBeenCalled()
  })
})

describe('writes that owe side effects', () => {
  it('credits the fundraiser and the customer when an order is marked paid', async () => {
    // Six payment paths run these two, each claiming its own column first. An
    // order marked paid by hand is a seventh, and used to run neither — leaving
    // the group and the customer permanently short against a paid order.
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock))
    prismaMock.order.update.mockResolvedValue({ orderNumber: 'JMS-1001' })
    creditFundraiserCommission.mockResolvedValue({ credited: true, amount: 25 })
    creditPurchaseLoyaltyPoints.mockResolvedValue({ awarded: true, points: 50 })

    const outcome = await WRITE_HANDLERS['order.markPaid'].execute({}, { ...actor, recordId: 'o1' })

    expect(creditFundraiserCommission).toHaveBeenCalledWith(prismaMock, 'o1')
    expect(creditPurchaseLoyaltyPoints).toHaveBeenCalledWith(prismaMock, 'o1')
    expect(outcome.message).toContain('25.00')
    expect(outcome.message).toContain('50 points')
  })

  it('refuses a set-to adjustment when the count moved underneath it', async () => {
    // "Set to 20" is a delta figured against a count that was read a moment ago.
    // If a sale lands in between, applying that delta lands somewhere else
    // entirely, so the observed count rides along and a changed one refuses.
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Black Bean', inventory: 10 })
    adjustInventory.mockRejectedValue(new StaleInventoryError(10, 15))

    await expect(
      WRITE_HANDLERS['inventory.adjust'].execute(
        { mode: 'SET', amount: 20, reason: 'Count' },
        { ...actor, recordId: 'p1' },
      ),
    ).rejects.toThrow(/Stock moved/)

    expect(adjustInventory.mock.calls[0][0].expectedPreviousStock).toBe(10)
  })

  it('does not pin a plain delta to a count it never read', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ name: 'Black Bean', inventory: 10 })
    adjustInventory.mockResolvedValue(undefined)

    await WRITE_HANDLERS['inventory.adjust'].execute(
      { mode: 'DELTA', amount: 5, reason: 'Found a case' },
      { ...actor, recordId: 'p1' },
    )

    expect(adjustInventory.mock.calls[0][0].expectedPreviousStock).toBeUndefined()
  })

  it('builds a campaign recipient list before letting it be scheduled', async () => {
    // The cron reaches a SCHEDULED campaign, flips it to SENDING, finds nothing
    // PENDING and leaves it stuck having sent nothing.
    prismaMock.emailCampaign.create.mockResolvedValue({ id: 'c1', name: 'Autumn' })
    insertRecipientsFromList.mockResolvedValue(340)

    await WRITE_HANDLERS['campaign.create'].execute(
      {
        name: 'Autumn',
        subject: 'Autumn heat',
        templateId: 't1',
        listId: 'list-1',
        scheduledAt: '2026-10-01T14:30:00.000Z',
        trackOpens: true,
        trackClicks: true,
      },
      { ...actor },
    )

    expect(insertRecipientsFromList).toHaveBeenCalledWith('c1', 'list-1', {}, {})
    const update = prismaMock.emailCampaign.update.mock.calls[0][0].data
    expect(update.totalRecipients).toBe(340)
    expect(update.status).toBe('SCHEDULED')
  })

  it('will not schedule a campaign with no list to send to', async () => {
    await expect(
      WRITE_HANDLERS['campaign.create'].execute(
        {
          name: 'Autumn',
          subject: 'Autumn heat',
          templateId: 't1',
          scheduledAt: '2026-10-01T14:30:00.000Z',
          trackOpens: true,
          trackClicks: true,
        },
        { ...actor },
      ),
    ).rejects.toThrow(/needs a mailing list/)

    expect(prismaMock.emailCampaign.create).not.toHaveBeenCalled()
  })

  it('takes the campaign back out when its list turns out to be empty', async () => {
    prismaMock.emailCampaign.create.mockResolvedValue({ id: 'c1', name: 'Autumn' })
    prismaMock.emailCampaign.delete.mockResolvedValue({ id: 'c1' })
    insertRecipientsFromList.mockResolvedValue(0)

    await expect(
      WRITE_HANDLERS['campaign.create'].execute(
        {
          name: 'Autumn',
          subject: 'Autumn heat',
          templateId: 't1',
          listId: 'list-1',
          trackOpens: true,
          trackClicks: true,
        },
        { ...actor },
      ),
    ).rejects.toThrow(/no subscribed contacts/)

    expect(prismaMock.emailCampaign.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it('derives fulfillment from the order status instead of asserting it', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      orderNumber: 'JMS-1001',
      status: 'PROCESSING',
      shippedAt: null,
      deliveredAt: null,
    })
    prismaMock.order.update.mockResolvedValue({ orderNumber: 'JMS-1001' })

    await WRITE_HANDLERS['order.status'].execute(
      { status: 'SHIPPED', paymentStatus: 'PAID', salesChannel: 'WEBSITE' },
      { ...actor, recordId: 'o1' },
    )

    const data = prismaMock.order.update.mock.calls[0][0].data
    expect(data.fulfillmentStatus).toBe('FULFILLED')
    expect(recordFulfillmentEvent).toHaveBeenCalled()
  })
})

describe('what the audit row keeps', () => {
  it('masks a password rather than storing the only plaintext copy of it', () => {
    // The handler hashes it before it reaches the user row; logging the payload
    // verbatim would leave it readable in AuditLog.changes forever.
    const kept = redactForAudit(
      { name: 'Pat', email: 'pat@example.com', password: 'hunter2hunter2' },
      WRITE_HANDLERS['user.create'].redact,
    ) as Record<string, unknown>

    expect(kept.password).toBe('[redacted]')
    expect(kept.name).toBe('Pat')
  })

  it('says nothing at all when no password was part of the change', () => {
    const kept = redactForAudit({ name: 'Pat', password: null }, ['password']) as Record<string, unknown>
    expect(kept.password).toBeNull()
  })

  it('declares the redaction on every handler that takes a password', () => {
    for (const [op, handler] of Object.entries(WRITE_HANDLERS)) {
      const spec = DESKTOP_FORMS[op as keyof typeof DESKTOP_FORMS]
      if (!spec) continue
      const takesPassword = spec.sections.some((section) =>
        section.fields.some((field) => field.type === 'password'),
      )
      if (takesPassword) {
        expect(handler.redact, `${op} logs its password in the clear`).toContain('password')
      }
    }
  })
})
