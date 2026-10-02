import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const findMany = vi.fn()
const count = vi.fn()

vi.mock('@/lib/rbac', () => ({ requirePermission: vi.fn().mockResolvedValue({ id: 'staff-1' }) }))
vi.mock('@/lib/prisma', () => {
  const client = { order: { findMany, count } }
  return { prisma: client, default: client }
})
vi.mock('@/lib/audit', () => ({ logAuditWithRequest: vi.fn() }))
vi.mock('@/lib/inventory-manager', () => ({ bulkAdjustInventoryInTx: vi.fn(), checkAndUpdateAlerts: vi.fn() }))
vi.mock('@/lib/orders/events', () => ({ emitOrderCreated: vi.fn() }))

const { GET } = await import('@/app/api/admin/orders/route')

const list = (query: string) => GET(new NextRequest(`http://localhost/api/admin/orders?${query}`))

describe('GET /api/admin/orders channel filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)
  })

  it('narrows to one sales channel, whatever the case it is written in', async () => {
    await list('channel=pos&limit=50')
    expect(findMany.mock.calls[0][0].where.salesChannel).toBe('POS')
    expect(count.mock.calls[0][0].where.salesChannel).toBe('POS')
  })

  it('returns each order’s latest payment method', async () => {
    await list('channel=POS')
    expect(findMany.mock.calls[0][0].include.payments).toMatchObject({ take: 1, orderBy: { createdAt: 'desc' } })
  })

  it('refuses an unknown channel instead of silently listing everything', async () => {
    const res = await list('channel=everything')
    expect(res.status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('lists every channel when none is asked for', async () => {
    await list('limit=10')
    expect(findMany.mock.calls[0][0].where.salesChannel).toBeUndefined()
  })
})
