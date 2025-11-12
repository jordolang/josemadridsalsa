import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TrainingDocumentSourceType, TrainingDocumentStatus } from '@prisma/client'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import {
  extractTextFromUpload,
  extractTextFromUrl,
  normalizeTrainingText,
  buildContentHash,
} from '@/lib/training-data/extractor'
import { TRAINING_MAX_CHARACTERS } from '@/lib/training-data/constants'
import { invalidateIndexedContentCache } from '@/lib/ai-rag/content-cache'

export const runtime = 'nodejs'

const URL_PAYLOAD_SCHEMA = z.object({
  url: z.string().url('Enter a valid URL to scrape.'),
  title: z.string().min(1).max(160).optional(),
  notes: z.string().max(2_000).optional(),
})

function clampValue(value: string | null | undefined, max = 500): string | undefined {
  if (!value) return undefined
  return value.length > max ? value.slice(0, max) : value
}

function mapStatus(extractionStatus: string, hasText: boolean): TrainingDocumentStatus {
  if (!hasText) {
    if (extractionStatus === 'unsupported') {
      return TrainingDocumentStatus.UNSUPPORTED
    }
    if (extractionStatus === 'needs_review') {
      return TrainingDocumentStatus.NEEDS_REVIEW
    }
    return TrainingDocumentStatus.FAILED
  }

  switch (extractionStatus) {
    case 'ready':
      return TrainingDocumentStatus.READY
    case 'needs_review':
      return TrainingDocumentStatus.NEEDS_REVIEW
    case 'unsupported':
      return TrainingDocumentStatus.UNSUPPORTED
    default:
      return TrainingDocumentStatus.FAILED
  }
}

async function handleFileUpload(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required.' }, { status: 400 })
  }

  const providedTitle = clampValue(formData.get('title')?.toString() ?? '', 160)
  const notes = clampValue(formData.get('notes')?.toString() ?? '', 2_000)
  const description = clampValue(formData.get('description')?.toString() ?? '', 600)

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const extraction = await extractTextFromUpload({
    buffer,
    fileName: file.name,
    mimeType: file.type,
  })

  if (extraction.status === 'unsupported') {
    const document = await prisma.trainingDocument.create({
      data: {
        title: providedTitle || extraction.title || file.name || 'Untitled document',
        description,
        sourceType: TrainingDocumentSourceType.UPLOAD,
        status: TrainingDocumentStatus.UNSUPPORTED,
        fileName: file.name,
        mimeType: file.type || null,
        fileSize: buffer.byteLength,
        warnings: extraction.warnings,
        notes,
      },
    })

    return NextResponse.json({ document })
  }

  const cleaned =
    extraction.text && extraction.text.trim().length > 0
      ? normalizeTrainingText(extraction.text)
      : null

  if (cleaned?.truncated) {
    extraction.warnings.push(
      `Document truncated to ${TRAINING_MAX_CHARACTERS.toLocaleString()} characters.`,
    )
  }

  const content = cleaned?.content ?? null
  const contentHash = content ? buildContentHash(content) : null

  if (contentHash) {
    const existing = await prisma.trainingDocument.findUnique({
      where: { contentHash },
    })

    if (existing) {
      return NextResponse.json(
        {
          error: 'An identical document already exists.',
          duplicateId: existing.id,
        },
        { status: 409 },
      )
    }
  }

  const status = mapStatus(extraction.status, Boolean(content))

  const document = await prisma.trainingDocument.create({
    data: {
      title: providedTitle || extraction.title || file.name || 'Untitled document',
      description,
      sourceType: TrainingDocumentSourceType.UPLOAD,
      status,
      fileName: file.name,
      mimeType: file.type || null,
      fileSize: buffer.byteLength,
      content,
      contentHash,
      warnings: extraction.warnings,
      notes,
      ingestedAt: status === TrainingDocumentStatus.READY ? new Date() : null,
    },
  })

  if (document.status === TrainingDocumentStatus.READY && document.content) {
    invalidateIndexedContentCache()
  }

  return NextResponse.json({ document })
}

async function handleUrlScrape(request: Request) {
  const payload = await request.json().catch(() => null)
  const parsed = URL_PAYLOAD_SCHEMA.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Unable to process URL request.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { url, title, notes } = parsed.data
  const extraction = await extractTextFromUrl(url)

  const cleaned =
    extraction.text && extraction.text.trim().length > 0
      ? normalizeTrainingText(extraction.text)
      : null

  if (cleaned?.truncated) {
    extraction.warnings.push(
      `Scraped content truncated to ${TRAINING_MAX_CHARACTERS.toLocaleString()} characters.`,
    )
  }

  const content = cleaned?.content ?? null
  const contentHash = content ? buildContentHash(content) : null

  if (contentHash) {
    const existing = await prisma.trainingDocument.findUnique({
      where: { contentHash },
    })

    if (existing) {
      return NextResponse.json(
        {
          error: 'This content already exists in the training set.',
          duplicateId: existing.id,
        },
        { status: 409 },
      )
    }
  }

  const status = mapStatus(extraction.status, Boolean(content))

  const document = await prisma.trainingDocument.create({
    data: {
      title: title || extraction.title || url,
      sourceType: TrainingDocumentSourceType.URL,
      status,
      url,
      content,
      contentHash,
      warnings: extraction.warnings,
      notes,
      scrapedAt: new Date(),
      ingestedAt: status === TrainingDocumentStatus.READY ? new Date() : null,
    },
  })

  if (document.status === TrainingDocumentStatus.READY && document.content) {
    invalidateIndexedContentCache()
  }

  return NextResponse.json({ document })
}

export async function POST(request: Request) {
  try {
    await requirePermission('content:write')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    return handleFileUpload(request)
  }

  return handleUrlScrape(request)
}
