import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, DELETE, GET } from '@/app/api/fundraisers/[id]/team/route'
import { prisma } from '@/lib/prisma'

// Mock dependencies
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const mockPrismaClient = {
    user: {
      findUnique: vi.fn(),
    },
    fundraiserAccount: {
      findFirst: vi.fn(),
    },
    fundraiser: {
      findUnique: vi.fn(),
    },
    fundraiserAccess: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  }
  return {
    default: mockPrismaClient,
    prisma: mockPrismaClient,
  }
})

describe('Fundraiser Team API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/fundraisers/[id]/team', () => {
    it('should deny access if not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/fundraisers/123/team', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      })

      const response = await POST(request, { params: { id: 'clx123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Unauthorized')
    })

    it('should enforce the 20 member limit', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const prismaMock = (await import('@/lib/prisma')).default
      
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'owner-id', email: 'owner@test.com', role: 'FUNDRAISER' } as any)
      
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ id: 'owner-id' } as any)
      vi.mocked(prismaMock.fundraiserAccount.findFirst).mockResolvedValue({ userId: 'owner-id', fundraiserId: 'clx123' } as any)
      vi.mocked(prismaMock.fundraiserAccess.count).mockResolvedValue(20)

      const request = new NextRequest('http://localhost/api/fundraisers/123/team', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com' }),
      })

      const response = await POST(request, { params: { id: 'clx123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Maximum team size (20) reached. Please remove someone before adding a new email.')
    })

    it('should add a team member successfully', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const prismaMock = (await import('@/lib/prisma')).default
      
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'owner-id', email: 'owner@test.com', role: 'FUNDRAISER' } as any)
      
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ id: 'owner-id' } as any)
      vi.mocked(prismaMock.fundraiserAccount.findFirst).mockResolvedValue({ userId: 'owner-id', fundraiserId: 'clx123' } as any)
      vi.mocked(prismaMock.fundraiserAccess.count).mockResolvedValue(10)
      vi.mocked(prismaMock.fundraiserAccess.findUnique).mockResolvedValue(null)
      
      vi.mocked(prismaMock.fundraiserAccess.create).mockResolvedValue({
        id: 'access-id',
        fundraiserId: 'clx123',
        email: 'new@example.com',
        role: 'WRITE',
        createdAt: new Date(),
      } as any)

      const request = new NextRequest('http://localhost/api/fundraisers/123/team', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com' }),
      })

      const response = await POST(request, { params: { id: 'clx123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.email).toBe('new@example.com')
      expect(prisma.fundraiserAccess.create).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/fundraisers/[id]/team', () => {
    it('should delete a team member successfully', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const prismaMock = (await import('@/lib/prisma')).default
      
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'owner-id', email: 'owner@test.com', role: 'FUNDRAISER' } as any)
      
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ id: 'owner-id' } as any)
      vi.mocked(prismaMock.fundraiserAccount.findFirst).mockResolvedValue({ userId: 'owner-id', fundraiserId: 'clx123' } as any)
      vi.mocked(prismaMock.fundraiserAccess.findUnique).mockResolvedValue({ 
        id: 'access-123', fundraiserId: 'clx123', email: 'member@test.com' 
      } as any)

      const request = new NextRequest('http://localhost/api/fundraisers/123/team?email=member@test.com', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'clx123' } })
      
      expect(response.status).toBe(200)
      expect(prismaMock.fundraiserAccess.delete).toHaveBeenCalledWith({
        where: { fundraiserId_email: { fundraiserId: 'clx123', email: 'member@test.com' } }
      })
    })

    it('should prevent non-owners from deleting members', async () => {
      const { getCurrentUser } = await import('@/lib/rbac')
      const prismaMock = (await import('@/lib/prisma')).default
      
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'stranger-id', email: 'stranger@test.com', role: 'FUNDRAISER' } as any)
      
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ id: 'stranger-id' } as any)
      vi.mocked(prismaMock.fundraiserAccount.findFirst).mockResolvedValue(null)
      vi.mocked(prismaMock.fundraiserAccess.findFirst).mockResolvedValue(null)
      
      const request = new NextRequest('http://localhost/api/fundraisers/123/team?email=member@test.com', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'clx123' } })
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data.error).toBe('Unauthorized')
    })
  })
})
