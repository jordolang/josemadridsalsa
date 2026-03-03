import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/forms/route'

// Mock dependencies
vi.mock('@/lib/api/partner-keys', () => ({
  requirePartner: vi.fn(),
  logPartnerApiCall: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    formTemplate: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    formTemplateVersion: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/forms/serialization', () => ({
  serializeTemplate: vi.fn((template) => template),
}))

vi.mock('@/lib/forms/utils', () => ({
  slugify: vi.fn((str) => str.toLowerCase().replace(/\s+/g, '-')),
  ensureUniqueSlug: vi.fn((slug) => Promise.resolve(slug)),
}))

vi.mock('@/lib/forms/ownership', () => ({
  resolveTemplateOwner: vi.fn(),
}))

vi.mock('./_lib/helpers', () => ({
  structureFromSections: vi.fn((sections) => sections),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Forms API', () => {
  const mockPartner = {
    id: 'partner-123',
    name: 'Test Partner',
    keyHash: 'hashed-key',
    scopes: [],
    isActive: true,
    apiKey: 'test-key',
    userId: 'user-123',
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any

  const mockOwner = {
    id: 'owner-123',
    email: 'owner@example.com',
    name: 'Form Owner',
    password: null,
    role: 'ADMIN',
    isEmailVerified: true,
    phone: null,
    dateOfBirth: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/forms', () => {
    it('should require partner authentication', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')

      vi.mocked(requirePartner).mockResolvedValue({
        error: new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return paginated form templates', async () => {
      const { requirePartner, logPartnerApiCall } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })

      const mockTemplates = [
        {
          id: 'template-1',
          slug: 'contact-form',
          name: 'Contact Form',
          description: 'A simple contact form',
          category: 'contact',
          tags: ['contact', 'form'],
          estimatedCompletion: '5 minutes',
          recommendedUses: ['Customer inquiries'],
          status: 'PUBLISHED',
          version: 1,
          structure: [],
          publishedAt: new Date(),
          createdById: 'owner-123',
          updatedById: 'owner-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template-2',
          slug: 'survey-form',
          name: 'Survey Form',
          description: 'A customer survey',
          category: 'survey',
          tags: ['survey', 'feedback'],
          estimatedCompletion: '10 minutes',
          recommendedUses: ['Customer feedback'],
          status: 'DRAFT',
          version: 1,
          structure: [],
          publishedAt: null,
          createdById: 'owner-123',
          updatedById: 'owner-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any

      vi.mocked(prisma.formTemplate.count).mockResolvedValue(2)
      vi.mocked(prisma.formTemplate.findMany).mockResolvedValue(mockTemplates)

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(2)
      expect(data.meta).toEqual({
        page: 1,
        perPage: 20,
        total: 2,
        totalPages: 1,
      })
      expect(logPartnerApiCall).toHaveBeenCalledWith(mockPartner, request, 200, { count: 2 })
    })

    it('should support pagination parameters', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(prisma.formTemplate.count).mockResolvedValue(50)
      vi.mocked(prisma.formTemplate.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/forms?page=2&perPage=10', {
        method: 'GET',
      })

      await GET(request)

      expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * 10
          take: 10,
        })
      )
    })

    it('should filter by status', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(prisma.formTemplate.count).mockResolvedValue(0)
      vi.mocked(prisma.formTemplate.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/forms?status=PUBLISHED', {
        method: 'GET',
      })

      await GET(request)

      expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED' },
        })
      )
    })

    it('should filter by category', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(prisma.formTemplate.count).mockResolvedValue(0)
      vi.mocked(prisma.formTemplate.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/forms?category=contact', {
        method: 'GET',
      })

      await GET(request)

      expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'contact' },
        })
      )
    })

    it('should support search by name and description', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(prisma.formTemplate.count).mockResolvedValue(0)
      vi.mocked(prisma.formTemplate.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/forms?search=contact', {
        method: 'GET',
      })

      await GET(request)

      expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'contact', mode: 'insensitive' } },
              { description: { contains: 'contact', mode: 'insensitive' } },
            ],
          },
        })
      )
    })

    it('should support ETag caching', async () => {
      const { requirePartner, logPartnerApiCall } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(prisma.formTemplate.count).mockResolvedValue(0)
      vi.mocked(prisma.formTemplate.findMany).mockResolvedValue([])

      // First request to get ETag
      const request1 = new NextRequest('http://localhost/api/forms', {
        method: 'GET',
      })
      const response1 = await GET(request1)
      const etag = response1.headers.get('ETag')

      // Second request with ETag
      const request2 = new NextRequest('http://localhost/api/forms', {
        method: 'GET',
        headers: {
          'if-none-match': etag!,
        },
      })
      const response2 = await GET(request2)

      expect(response2.status).toBe(304)
      expect(logPartnerApiCall).toHaveBeenCalledWith(mockPartner, request2, 304)
    })

    it('should enforce max per page limit', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(prisma.formTemplate.count).mockResolvedValue(0)
      vi.mocked(prisma.formTemplate.findMany).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/forms?perPage=100', {
        method: 'GET',
      })

      await GET(request)

      expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // MAX_PER_PAGE
        })
      )
    })
  })

  describe('POST /api/forms', () => {
    const validPayload = {
      name: 'Contact Form',
      description: 'A contact form',
      categoryId: 'contact',
      tags: ['contact', 'form'],
      status: 'DRAFT' as const,
      sections: [
        {
          id: 'section-1',
          label: 'Contact Information',
          description: 'Your contact details',
          defaultIncluded: true,
          fields: [
            {
              id: 'field-1',
              label: 'Name',
              type: 'short-text' as const,
              placeholder: 'Enter your name',
            },
            {
              id: 'field-2',
              label: 'Email',
              type: 'short-text' as const,
              placeholder: 'Enter your email',
            },
          ],
        },
      ],
    }

    const mockTemplate = {
      id: 'template-123',
      slug: 'contact-form',
      name: 'Contact Form',
      description: 'A contact form',
      category: 'contact',
      tags: ['contact', 'form'],
      status: 'DRAFT',
      structure: validPayload.sections,
      version: 1,
      createdById: 'owner-123',
      updatedById: 'owner-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should require partner authentication with write permission', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')

      vi.mocked(requirePartner).mockResolvedValue({
        error: new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Form' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
      expect(requirePartner).toHaveBeenCalledWith(request, 'forms:write')
    })

    it('should validate payload schema', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should handle invalid JSON', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid JSON payload')
    })

    it('should create form template with audit logging', async () => {
      const { requirePartner, logPartnerApiCall } = await import('@/lib/api/partner-keys')
      const { logAudit } = await import('@/lib/audit')
      const { prisma } = await import('@/lib/prisma')
      const { resolveTemplateOwner } = await import('@/lib/forms/ownership')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(resolveTemplateOwner).mockResolvedValue(mockOwner)

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          formTemplate: {
            create: vi.fn().mockResolvedValue(mockTemplate),
          },
          formTemplateVersion: {
            create: vi.fn().mockResolvedValue({}),
          },
        })
      })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data).toBeDefined()

      // Verify audit logging
      expect(logAudit).toHaveBeenCalledWith({
        userId: mockOwner.id,
        action: 'CREATE',
        entityType: 'FormTemplate',
        entityId: mockTemplate.id,
        changes: expect.objectContaining({
          slug: 'contact-form',
          name: 'Contact Form',
          description: 'A contact form',
          category: 'contact',
          status: 'DRAFT',
          partnerId: mockPartner.id,
          partnerName: mockPartner.name,
        }),
      })

      // Verify partner API call logging
      expect(logPartnerApiCall).toHaveBeenCalledWith(
        mockPartner,
        request,
        201,
        { slug: 'contact-form' }
      )
    })

    it('should generate unique slug', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')
      const { resolveTemplateOwner } = await import('@/lib/forms/ownership')
      const { ensureUniqueSlug } = await import('@/lib/forms/utils')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(resolveTemplateOwner).mockResolvedValue(mockOwner)
      vi.mocked(ensureUniqueSlug).mockResolvedValue('contact-form-2')

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          formTemplate: {
            create: vi.fn().mockResolvedValue({ ...mockTemplate, slug: 'contact-form-2' }),
          },
          formTemplateVersion: {
            create: vi.fn().mockResolvedValue({}),
          },
        })
      })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      })

      await POST(request)

      expect(ensureUniqueSlug).toHaveBeenCalledWith('contact-form')
    })

    it('should set publishedAt when status is PUBLISHED', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')
      const { resolveTemplateOwner } = await import('@/lib/forms/ownership')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(resolveTemplateOwner).mockResolvedValue(mockOwner)

      let createData: any
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          formTemplate: {
            create: vi.fn().mockImplementation((data) => {
              createData = data
              return Promise.resolve({ ...mockTemplate, ...data.data })
            }),
          },
          formTemplateVersion: {
            create: vi.fn().mockResolvedValue({}),
          },
        })
      })

      const publishedPayload = {
        ...validPayload,
        status: 'PUBLISHED' as const,
      }

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: JSON.stringify(publishedPayload),
      })

      await POST(request)

      expect(createData.data.publishedAt).toBeDefined()
      expect(createData.data.publishedAt).toBeInstanceOf(Date)
    })

    it('should create form template version', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')
      const { resolveTemplateOwner } = await import('@/lib/forms/ownership')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(resolveTemplateOwner).mockResolvedValue(mockOwner)

      let versionCreateCalled = false
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          formTemplate: {
            create: vi.fn().mockResolvedValue(mockTemplate),
          },
          formTemplateVersion: {
            create: vi.fn().mockImplementation(() => {
              versionCreateCalled = true
              return Promise.resolve({})
            }),
          },
        })
      })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      })

      await POST(request)

      expect(versionCreateCalled).toBe(true)
    })

    it('should revalidate paths after creation', async () => {
      const { requirePartner } = await import('@/lib/api/partner-keys')
      const { prisma } = await import('@/lib/prisma')
      const { resolveTemplateOwner } = await import('@/lib/forms/ownership')
      const { revalidatePath } = await import('next/cache')

      vi.mocked(requirePartner).mockResolvedValue({ partner: mockPartner })
      vi.mocked(resolveTemplateOwner).mockResolvedValue(mockOwner)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback({
          formTemplate: {
            create: vi.fn().mockResolvedValue(mockTemplate),
          },
          formTemplateVersion: {
            create: vi.fn().mockResolvedValue({}),
          },
        })
      })

      const request = new NextRequest('http://localhost/api/forms', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      })

      await POST(request)

      expect(revalidatePath).toHaveBeenCalledWith('/forms')
      // The slug is generated from slugify(payload.name) which is mocked
      expect(revalidatePath).toHaveBeenCalledWith(expect.stringContaining('/forms/'))
      expect(revalidatePath).toHaveBeenCalledTimes(2)
    })
  })
})
