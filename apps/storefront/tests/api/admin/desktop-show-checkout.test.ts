import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Saving a show checkout onto the packing manifest. A draft manifest is the
 * plan, so the first cart replaces it; a manifest already out has the next
 * cart added to it; a returned show refuses more.
 */

const tx = {
  eventManifest: { upsert: vi.fn() },
  eventManifestItem: { deleteMany: vi.fn(), upsert: vi.fn() },
}
const prisma = {
  featuredEvent: { findUnique: vi.fn(), findMany: vi.fn() },
  product: { findMany: vi.fn() },
  $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
}
const rbac = { getCurrentUser: vi.fn(), hasPermission: vi.fn(), isStaff: vi.fn() }
const audit = { logAudit: vi.fn() }

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/rbac', () => rbac)
vi.mock('@/lib/audit', () => audit)

const { POST } = await import('@/app/api/admin/desktop/show-checkout/route')

const mild = { id: 'p1', name: 'Mild Salsa', sku: 'JMS-MILD-001', barcode: '093662452874', unitsPerCase: 12 }

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/admin/desktop/show-checkout', { method: 'POST', body: JSON.stringify(body) }),
  )
}

const checkout = {
  eventId: 'e1',
  checkedOutBy: 'Jordan',
  checkoutDate: '2026-10-30',
  cases: [
    { productId: 'p1', half: false, date: '2029-02-15' },
    { productId: 'p1', half: true, date: '2029-02-15' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  rbac.getCurrentUser.mockResolvedValue({ id: 'u1', role: 'ADMIN' })
  rbac.isStaff.mockReturnValue(true)
  rbac.hasPermission.mockResolvedValue(true)
  prisma.product.findMany.mockResolvedValue([mild])
  tx.eventManifest.upsert.mockResolvedValue({ id: 'm1' })
})

describe('POST /api/admin/desktop/show-checkout', () => {
  it('replaces a draft plan with what was scanned and marks it packed', async () => {
    prisma.featuredEvent.findUnique.mockResolvedValue({
      id: 'e1',
      title: 'Pumpkin Fest',
      manifest: { status: 'DRAFT', notes: null, packedAt: null, items: [{ productId: 'p1', takenCases: 5, takenJars: 0, expirationDate: null }] },
    })

    const response = await post(checkout)
    expect(response.status).toBe(200)
    expect(tx.eventManifestItem.deleteMany).toHaveBeenCalledWith({ where: { manifestId: 'm1' } })
    const write = tx.eventManifestItem.upsert.mock.calls[0][0]
    expect(write.create).toMatchObject({ productId: 'p1', takenCases: 1, takenJars: 6 })
    expect(write.create.expirationDate.toISOString().slice(0, 10)).toBe('2029-02-15')
    expect(tx.eventManifest.upsert.mock.calls[0][0].update).toMatchObject({ status: 'PACKED' })
    expect(tx.eventManifest.upsert.mock.calls[0][0].update.notes).toMatch(/Checked out by Jordan on 10\/30\/26/)
  })

  it('adds a second cart to a manifest that is already out', async () => {
    prisma.featuredEvent.findUnique.mockResolvedValue({
      id: 'e1',
      title: 'Pumpkin Fest',
      manifest: {
        status: 'PACKED',
        notes: 'Checked out by Jordan on 10/30/26. Mild Salsa: 2 × 01/10/29',
        packedAt: new Date('2026-10-30T12:00:00Z'),
        items: [{ productId: 'p1', takenCases: 2, takenJars: 0, expirationDate: new Date('2029-01-10') }],
      },
    })

    await post(checkout)
    expect(tx.eventManifestItem.deleteMany).not.toHaveBeenCalled()
    const write = tx.eventManifestItem.upsert.mock.calls[0][0]
    expect(write.update).toMatchObject({ takenCases: 3, takenJars: 6 })
    expect(write.update.expirationDate.toISOString().slice(0, 10)).toBe('2029-01-10')
    expect(tx.eventManifest.upsert.mock.calls[0][0].update.notes.split('\n')).toHaveLength(2)
  })

  it('refuses a show already marked returned', async () => {
    prisma.featuredEvent.findUnique.mockResolvedValue({ id: 'e1', title: 'Pumpkin Fest', manifest: { status: 'RETURNED', items: [] } })
    const response = await post(checkout)
    expect(response.status).toBe(409)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuses an undated case and anyone without events:write', async () => {
    const undated = await post({ ...checkout, cases: [{ productId: 'p1', half: false, date: '' }] })
    expect(undated.status).toBe(400)

    rbac.hasPermission.mockResolvedValue(false)
    const denied = await post(checkout)
    expect(denied.status).toBe(403)
    expect(rbac.hasPermission).toHaveBeenCalledWith(expect.anything(), 'events:write')
  })
})
