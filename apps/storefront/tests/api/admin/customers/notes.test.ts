import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requirePermission = vi.fn()
const customerFindUnique = vi.fn()
const noteCreate = vi.fn()
const noteDeleteMany = vi.fn()

vi.mock('@/lib/rbac', () => ({ requirePermission }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const client = {
    customer: { findUnique: customerFindUnique },
    customerNote: { create: noteCreate, deleteMany: noteDeleteMany },
  }
  return { prisma: client, default: client }
})

const { POST } = await import('@/app/api/admin/customers/[id]/notes/route')
const { DELETE } = await import('@/app/api/admin/customers/[id]/notes/[noteId]/route')

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/admin/customers/c1/notes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'c1' }) },
  )
}

describe('customer account notes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ id: 'admin1', name: 'Mike', email: 'mike@example.com' })
    customerFindUnique.mockResolvedValue({ id: 'c1' })
    noteCreate.mockImplementation(({ data }) => ({ id: 'n1', ...data }))
  })

  it('adds a note signed with the admin who wrote it', async () => {
    const response = await post({ body: '  Promised a replacement jar  ' })

    expect(response.status).toBe(201)
    expect(requirePermission).toHaveBeenCalledWith('users:write')
    expect(noteCreate).toHaveBeenCalledWith({
      data: { customerId: 'c1', body: 'Promised a replacement jar', authorId: 'admin1', authorName: 'Mike' },
    })
  })

  it('rejects an empty note', async () => {
    const response = await post({ body: '   ' })
    expect(response.status).toBe(400)
    expect(noteCreate).not.toHaveBeenCalled()
  })

  it('404s for an unknown customer', async () => {
    customerFindUnique.mockResolvedValue(null)
    const response = await post({ body: 'Hi' })
    expect(response.status).toBe(404)
  })

  it('only deletes a note that belongs to the customer in the URL', async () => {
    noteDeleteMany.mockResolvedValue({ count: 0 })

    const response = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'c1', noteId: 'n9' }),
    })

    expect(noteDeleteMany).toHaveBeenCalledWith({ where: { id: 'n9', customerId: 'c1' } })
    expect(response.status).toBe(404)
  })
})
