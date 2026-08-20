import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { DuplicateCaptureError, createCapture, runExtraction } from '@/lib/form-capture/service'

/**
 * GET  /api/admin/form-captures  — the review queue.
 * POST /api/admin/form-captures  — record a photographed form and read it.
 */

const CAPTURE_STATUSES = [
  'UPLOADED',
  'EXTRACTING',
  'NEEDS_REVIEW',
  'APPROVED',
  'POSTED',
  'FAILED',
  'REJECTED',
] as const

const FORM_TYPES = [
  'SHOW_SETTLEMENT',
  'FARMERS_MARKET',
  'FUNDRAISER_ORDER',
  'MILEAGE_LOG',
  'EXPENSE_RECEIPT',
  'OTHER',
] as const

const createSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().max(255).nullable().optional(),
  mimeType: z.string().trim().max(100).nullable().optional(),
  /** SHA-256 hex of the uploaded bytes; the hard guard against the same photo posting twice. */
  fileHash: z.string().regex(/^[a-f0-9]{64}$/, 'fileHash must be a hex SHA-256 digest'),
  formType: z.enum(FORM_TYPES),
  eventId: z.string().trim().min(1).nullable().optional(),
})

const listQuerySchema = z.object({
  status: z.enum(CAPTURE_STATUSES).optional(),
  formType: z.enum(FORM_TYPES).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission('financials:read')

    const parsed = listQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) return fail('Invalid query', 400, parsed.error.flatten())

    const { status, formType, take } = parsed.data

    const captures = await prisma.formCapture.findMany({
      where: { ...(status ? { status } : {}), ...(formType ? { formType } : {}) },
      orderBy: [{ status: 'asc' }, { uploadedAt: 'desc' }],
      take,
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })

    const counts = await prisma.formCapture.groupBy({ by: ['status'], _count: { _all: true } })

    return ok({
      captures,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    })
  } catch (error: any) {
    return fail(error.message, error.status ?? 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('financials:write')

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return fail('Invalid request body', 400)

    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return fail('Invalid capture', 400, parsed.error.flatten())

    let capture
    try {
      capture = await createCapture({ ...parsed.data, uploadedById: user.id })
    } catch (error) {
      if (error instanceof DuplicateCaptureError) {
        // 409, not 400: the client did nothing wrong, this exact photo is simply already here.
        return fail(error.message, 409, { existingCaptureId: error.existingId })
      }
      throw error
    }

    await logAudit({
      userId: user.id,
      action: 'form_capture.create',
      entityType: 'FormCapture',
      entityId: capture.id,
      changes: { formType: capture.formType, fileName: capture.fileName },
    })

    // Read the form now. A failure here is recorded on the capture itself rather than thrown, so
    // the upload is never lost to a transient extraction problem — it lands as FAILED and is
    // re-runnable from the review queue.
    let extracted = capture
    try {
      extracted = await runExtraction(capture.id)
    } catch (error) {
      logger.error('form-capture: extraction step threw', { captureId: capture.id, error })
    }

    return ok({ capture: extracted }, 201)
  } catch (error: any) {
    return fail(error.message, error.status ?? 500)
  }
}
