import { NextResponse } from 'next/server'
import { TrainingDocumentSourceType, TrainingDocumentStatus } from '@prisma/client'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import {
  extractTextFromUpload,
  extractTextFromUrl,
  normalizeTrainingText,
  buildContentHash,
  type ExtractionResult,
} from '@/lib/training-data/extractor'
import { invalidateIndexedContentCache } from '@/lib/ai-rag/content-cache'

function mapStatus(status: ExtractionResult['status']): TrainingDocumentStatus {
  switch (status) {
    case 'ready':
      return TrainingDocumentStatus.READY
    case 'needs_review':
      return TrainingDocumentStatus.NEEDS_REVIEW
    case 'unsupported':
      return TrainingDocumentStatus.UNSUPPORTED
    case 'failed':
    default:
      return TrainingDocumentStatus.FAILED
  }
}

async function upsertTrainingDocument({
  title,
  description,
  sourceType,
  status,
  fileName,
  mimeType,
  fileSize,
  url,
  content,
  warnings,
  notes,
}: {
  title: string
  description?: string | null
  sourceType: TrainingDocumentSourceType
  status: TrainingDocumentStatus
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  url?: string | null
  content?: string | null
  warnings?: string[]
  notes?: string | null
}) {
  const contentHash = content ? buildContentHash(content) : null

  if (contentHash) {
    const existing = await prisma.trainingDocument.findUnique({
      where: { contentHash },
    })

    if (existing) {
      return existing
    }
  }

  return prisma.trainingDocument.create({
    data: {
      title,
      description: description ?? null,
      sourceType,
      status,
      fileName: fileName ?? null,
      mimeType: mimeType ?? null,
      fileSize: fileSize ?? null,
      url: url ?? null,
      content: content ?? null,
      contentHash,
      warnings: warnings ?? [],
      notes: notes ?? null,
      scrapedAt: sourceType === TrainingDocumentSourceType.URL ? new Date() : null,
      ingestedAt: content ? new Date() : null,
    },
  })
}

function buildErrorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    await requirePermission('content:write')
  } catch (error: any) {
    return buildErrorResponse(error?.message ?? 'Unauthorized', 403)
  }

  const contentType = request.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null)
      const url = body?.url as string | undefined
      const notes = body?.notes as string | undefined
      const providedTitle = body?.title as string | undefined

      if (!url) {
        return buildErrorResponse('URL is required')
      }

      const extraction = await extractTextFromUrl(url)
      const normalized = extraction.text ? normalizeTrainingText(extraction.text) : null
      const document = await upsertTrainingDocument({
        title: extraction.title || providedTitle || url,
        description: null,
        sourceType: TrainingDocumentSourceType.URL,
        status: mapStatus(extraction.status),
        url,
        content: normalized?.content ?? null,
        warnings: extraction.warnings,
        notes: notes ?? null,
      })

      if (extraction.status === 'ready') {
        invalidateIndexedContentCache()
      }

      return NextResponse.json({
        document,
        warnings: extraction.warnings ?? [],
        truncated: normalized?.truncated ?? false,
      })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const notes = (formData.get('notes') as string | null) ?? null
    const description = (formData.get('description') as string | null) ?? null

    if (!(file instanceof File)) {
      return buildErrorResponse('File is required')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extraction = await extractTextFromUpload({
      buffer,
      fileName: file.name,
      mimeType: file.type || null,
    })

    const normalized = extraction.text ? normalizeTrainingText(extraction.text) : null

    const document = await upsertTrainingDocument({
      title: extraction.title || file.name,
      description,
      sourceType: TrainingDocumentSourceType.UPLOAD,
      status: mapStatus(extraction.status),
      fileName: file.name,
      mimeType: file.type || null,
      fileSize: file.size,
      content: normalized?.content ?? null,
      warnings: extraction.warnings,
      notes,
    })

    if (extraction.status === 'ready') {
      invalidateIndexedContentCache()
    }

    return NextResponse.json({
      document,
      warnings: extraction.warnings ?? [],
      truncated: normalized?.truncated ?? false,
    })
  } catch (error: any) {
    console.error('[training-data] Error handling request', error)
    return buildErrorResponse('Failed to process training data', 500)
  }
}
