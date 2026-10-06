import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const create = vi.fn()
const fundraiserFindUnique = vi.fn()
const codeFindUnique = vi.fn()
const update = vi.fn()

vi.mock('@/lib/admin-auth', () => ({ requireAdminSession: vi.fn().mockResolvedValue({ id: 'admin' }) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(), logAuditWithRequest: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const client = {
    arenaGameCode: { create, findUnique: codeFindUnique, update, findMany: vi.fn() },
    fundraiser: { findUnique: fundraiserFindUnique },
  }
  return { prisma: client, default: client }
})

const { POST } = await import('@/app/api/admin/arena/game-codes/route')
const { PATCH } = await import('@/app/api/admin/arena/game-codes/[id]/route')

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/admin/arena/game-codes', { method: 'POST', body: JSON.stringify(body) }))

describe('making Battle Arena game codes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    create.mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data }))
  })

  it('makes a code for a typed group name', async () => {
    const res = await post({ groupName: '  Lincoln   PTA ' })
    expect(res.status).toBe(201)
    const { data } = create.mock.calls[0][0]
    expect(data).toMatchObject({ groupName: 'Lincoln PTA', fundraiserId: null, createdBy: 'admin' })
    expect(data.code).toMatch(/^JM-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  })

  it("names the group after a picked fundraiser's organization", async () => {
    fundraiserFindUnique.mockResolvedValue({ organizationName: 'Eagles Band Boosters', name: 'Fall drive' })
    await post({ fundraiserId: 'f1' })
    expect(create.mock.calls[0][0].data).toMatchObject({ groupName: 'Eagles Band Boosters', fundraiserId: 'f1' })
  })

  it('needs a group name or a fundraiser', async () => {
    expect((await post({})).status).toBe(422)
    expect(create).not.toHaveBeenCalled()
  })

  it('tries another code when one is already taken', async () => {
    create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
    expect((await post({ groupName: 'Lincoln PTA' })).status).toBe(201)
    expect(create).toHaveBeenCalledTimes(2)
  })
})

describe('revoking a game code', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stamps and clears revokedAt', async () => {
    codeFindUnique.mockResolvedValue({ id: 'c1' })
    update.mockResolvedValue({ id: 'c1' })
    const patch = (revoked: boolean) =>
      PATCH(new NextRequest('http://localhost/api/admin/arena/game-codes/c1', { method: 'PATCH', body: JSON.stringify({ revoked }) }), {
        params: Promise.resolve({ id: 'c1' }),
      })
    await patch(true)
    expect(update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date)
    await patch(false)
    expect(update.mock.calls[1][0].data.revokedAt).toBeNull()
  })
})
