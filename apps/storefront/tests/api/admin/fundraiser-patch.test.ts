import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rbac', () => ({ getCurrentUser: vi.fn(), hasPermission: vi.fn() }))
vi.mock('@/lib/audit', () => ({ createChangeSnapshot: vi.fn(), logAuditWithRequest: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {} }))

const route = await import('@/app/api/admin/fundraisers/[id]/route')

describe('/api/admin/fundraisers/[id]', () => {
  // The manage page saves fulfillment and commission settings with PATCH.
  it('accepts PATCH as a partial update', () => {
    expect(route.PATCH).toBe(route.PUT)
  })
})
