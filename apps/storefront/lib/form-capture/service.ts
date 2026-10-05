import type { CaptureFormType, FormCapture, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ExtractionError, extractForm } from './extract'
import { decideStatus, lowestConfidence, reconcile } from './parse'
import { postCaptureToLedger } from './post'

/**
 * Orchestration for the photograph-to-ledger pipeline.
 *
 * The route handlers stay thin; everything that decides what happens to a form lives here so it
 * can be reasoned about (and tested) in one place.
 */

export class DuplicateCaptureError extends Error {
  constructor(readonly existingId: string) {
    super('This exact photo has already been uploaded.')
    this.name = 'DuplicateCaptureError'
  }
}

/**
 * Record an uploaded form. Extraction is a separate step so a slow vision call never holds the
 * upload request open — the phone gets an id back immediately.
 *
 * The `fileHash` unique constraint is the hard duplicate guard: the identical photo cannot be
 * captured twice, no matter how many times someone taps upload on a bad connection.
 */
export async function createCapture(input: {
  fileUrl: string
  fileName?: string | null
  mimeType?: string | null
  fileHash: string
  formType: CaptureFormType
  uploadedById: string
  eventId?: string | null
}): Promise<FormCapture> {
  const existing = await prisma.formCapture.findUnique({
    where: { fileHash: input.fileHash },
    select: { id: true },
  })
  if (existing) throw new DuplicateCaptureError(existing.id)

  return prisma.formCapture.create({
    data: {
      fileUrl: input.fileUrl,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      fileHash: input.fileHash,
      formType: input.formType,
      uploadedById: input.uploadedById,
      eventId: input.eventId ?? null,
      status: 'UPLOADED',
    },
  })
}

/**
 * A form of the same type, for the same date and event, that is already in the system is very
 * likely a re-photograph. Advisory only — it is surfaced to the reviewer, never auto-rejected,
 * because a genuine second market on the same day is a real thing.
 */
export async function findLikelyDuplicate(capture: {
  id: string
  formType: CaptureFormType
  capturedOn: Date | null
  eventId: string | null
}): Promise<string | null> {
  if (!capture.capturedOn) return null

  const match = await prisma.formCapture.findFirst({
    where: {
      id: { not: capture.id },
      formType: capture.formType,
      capturedOn: capture.capturedOn,
      eventId: capture.eventId,
      status: { in: ['APPROVED', 'POSTED', 'NEEDS_REVIEW'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  return match?.id ?? null
}

/**
 * Read a captured form and persist what it says.
 *
 * Ends with the capture either APPROVED (confident and self-consistent) or NEEDS_REVIEW. Nothing
 * posts to the ledger here — posting is always a separate, explicit step.
 */
export async function runExtraction(captureId: string): Promise<FormCapture> {
  const capture = await prisma.formCapture.findUnique({ where: { id: captureId } })
  if (!capture) throw new Error(`Capture ${captureId} not found`)
  if (capture.status === 'POSTED') {
    throw new Error('This form has already posted to the ledger and cannot be re-read.')
  }

  await prisma.formCapture.update({
    where: { id: captureId },
    data: { status: 'EXTRACTING', extractionError: null },
  })

  let result
  try {
    result = await extractForm({
      fileUrl: capture.fileUrl,
      formType: capture.formType,
      sessionId: captureId,
      userId: capture.uploadedById,
    })
  } catch (error) {
    const message =
      error instanceof ExtractionError ? error.message : 'Extraction failed for an unknown reason.'
    logger.error('form-capture: extraction failed', { captureId, error })
    return prisma.formCapture.update({
      where: { id: captureId },
      data: { status: 'FAILED', extractionError: message },
    })
  }

  const { reconciled } = reconcile(result.classified, result.statedTotalCents)
  const status = decideStatus({ lines: result.classified, reconciled })
  const minConfidence = lowestConfidence(result.classified)

  const duplicateOfId = await findLikelyDuplicate({
    id: capture.id,
    formType: capture.formType,
    capturedOn: result.capturedOn,
    eventId: capture.eventId,
  })

  return prisma.$transaction(async (tx) => {
    // Re-reading a form replaces what the previous read said. Safe because a POSTED capture is
    // rejected above, so no line being deleted here has ever produced a ledger row.
    await tx.formCaptureLine.deleteMany({ where: { captureId } })

    await tx.formCaptureLine.createMany({
      data: result.classified.map((line, index) => ({
        captureId,
        lineNumber: index + 1,
        label: line.label,
        direction: line.direction,
        category: line.category,
        amountCents: line.amountCents,
        quantity: line.quantity,
        confidence: line.confidence,
        rawValue: line.rawValue,
      })),
    })

    return tx.formCapture.update({
      where: { id: captureId },
      data: {
        // A suspected duplicate always gets a human look, however confident the read was.
        status: duplicateOfId ? 'NEEDS_REVIEW' : status,
        capturedOn: result.capturedOn,
        statedTotalCents: result.statedTotalCents,
        reconciled,
        minConfidence,
        extractedAt: new Date(),
        extractionModel: result.model,
        rawExtraction: result.raw as Prisma.InputJsonValue,
        extractionError: null,
        duplicateOfId,
      },
    })
  })
}

/**
 * Approve a capture and write its ledger rows in one step.
 *
 * Approval and posting are deliberately joined: a capture sitting in APPROVED but unposted would
 * be money that a person has confirmed and the books still do not show.
 */
export async function approveAndPost(input: {
  captureId: string
  reviewerId: string
  reviewNotes?: string | null
}) {
  const capture = await prisma.formCapture.findUnique({
    where: { id: input.captureId },
    select: { status: true },
  })
  if (!capture) throw new Error(`Capture ${input.captureId} not found`)
  if (capture.status === 'POSTED') {
    return { alreadyPosted: true, result: await postCaptureToLedger(input.captureId) }
  }
  if (capture.status !== 'NEEDS_REVIEW' && capture.status !== 'APPROVED') {
    throw new Error(`A ${capture.status} capture cannot be approved.`)
  }

  await prisma.formCapture.update({
    where: { id: input.captureId },
    data: {
      status: 'APPROVED',
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes ?? null,
    },
  })

  return { alreadyPosted: false, result: await postCaptureToLedger(input.captureId) }
}

/** Mark a form unusable. Terminal — a rejected capture never posts. */
export async function rejectCapture(input: {
  captureId: string
  reviewerId: string
  reviewNotes?: string | null
}): Promise<FormCapture> {
  return prisma.formCapture.update({
    where: { id: input.captureId },
    data: {
      status: 'REJECTED',
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes ?? null,
    },
  })
}
