import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from '@/app/api/admin/training-data/route'
import { TrainingDocumentSourceType, TrainingDocumentStatus } from '@prisma/client'

const requirePermissionMock = vi.fn()
vi.mock('@/lib/rbac', () => ({
  requirePermission: (...args: any[]) => requirePermissionMock(...args),
}))

const createMock = vi.fn()
const findUniqueMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    trainingDocument: {
      findMany: vi.fn(),
      findUnique: (...args: any[]) => findUniqueMock(...args),
      create: (...args: any[]) => createMock(...args),
    },
  },
}))

const extractUploadMock = vi.fn()
const extractUrlMock = vi.fn()
const normalizeMock = vi.fn()
const hashMock = vi.fn()

vi.mock('@/lib/training-data/extractor', () => ({
  extractTextFromUpload: (...args: any[]) => extractUploadMock(...args),
  extractTextFromUrl: (...args: any[]) => extractUrlMock(...args),
  normalizeTrainingText: (...args: any[]) => normalizeMock(...args),
  buildContentHash: (...args: any[]) => hashMock(...args),
}))

const invalidateCacheMock = vi.fn()
vi.mock('@/lib/ai-rag/content-cache', () => ({
  invalidateIndexedContentCache: () => invalidateCacheMock(),
}))

describe('admin training data API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermissionMock.mockResolvedValue({ id: 'user-1' })
    createMock.mockImplementation(async ({ data }: any) => ({
      id: 'doc-id',
      ...data,
    }))
    findUniqueMock.mockResolvedValue(null)
    normalizeMock.mockImplementation((text: string) => ({ content: text, truncated: false }))
    hashMock.mockImplementation((content: string) => `hash:${content.length}`)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ingests uploaded files and invalidates cache when ready', async () => {
    extractUploadMock.mockResolvedValue({
      text: 'Document body',
      title: 'Doc Title',
      warnings: [],
      status: 'ready',
    })

    const file = new File(['Document body'], 'doc.txt', { type: 'text/plain' })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('notes', 'keep for ai')

    const response = await POST(
      new Request('http://localhost/api/admin/training-data', {
        method: 'POST',
        body: formData,
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as any
    expect(payload.document.status).toBe(TrainingDocumentStatus.READY)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: TrainingDocumentSourceType.UPLOAD,
          status: TrainingDocumentStatus.READY,
          content: 'Document body',
        }),
      }),
    )
    expect(invalidateCacheMock).toHaveBeenCalledTimes(1)
  })

  it('creates URL documents and clears cache when ready', async () => {
    extractUrlMock.mockResolvedValue({
      text: 'Fundraising overview',
      title: 'Fundraising',
      warnings: [],
      status: 'ready',
    })

    const response = await POST(
      new Request('http://localhost/api/admin/training-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com', notes: 'source' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: TrainingDocumentSourceType.URL,
          status: TrainingDocumentStatus.READY,
        }),
      }),
    )
    expect(invalidateCacheMock).toHaveBeenCalledTimes(1)
  })

  it('marks uploads that need review without invalidating cache', async () => {
    extractUploadMock.mockResolvedValue({
      text: null,
      title: 'Scan',
      warnings: ['scanned pdf'],
      status: 'needs_review',
    })

    const formData = new FormData()
    formData.append('file', new File([''], 'scan.pdf', { type: 'application/pdf' }))

    const response = await POST(
      new Request('http://localhost/api/admin/training-data', {
        method: 'POST',
        body: formData,
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as any
    expect(payload.document.status).toBe(TrainingDocumentStatus.NEEDS_REVIEW)
    expect(normalizeMock).not.toHaveBeenCalled()
    expect(hashMock).not.toHaveBeenCalled()
    expect(invalidateCacheMock).not.toHaveBeenCalled()
  })
})
