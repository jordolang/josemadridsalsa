import type { FormCapture, FormCaptureLine, Prisma, SalesChannel } from '@prisma/client'
import prisma from '@/lib/prisma'

/**
 * Turning an approved capture into ledger rows.
 *
 * Everything here is built around one rule: a photographed form must never be able to post its
 * money twice. Two independent guards enforce it —
 *   1. `LedgerEntry.dedupeKey` is unique and derived from the line id, so a re-run upserts.
 *   2. `FormCaptureLine.ledgerEntryId` is unique, so a line that already posted is skipped.
 * Either alone would be enough; both are present because double-counting is the specific failure
 * this whole pipeline exists to end.
 */

/** The channel a form's money is attributed to, by form type. */
const CHANNEL_BY_FORM_TYPE: Record<string, SalesChannel> = {
  SHOW_SETTLEMENT: 'EVENT',
  FARMERS_MARKET: 'EVENT',
  FUNDRAISER_ORDER: 'FUNDRAISER',
  MILEAGE_LOG: 'MANUAL',
  EXPENSE_RECEIPT: 'MANUAL',
  OTHER: 'MANUAL',
}

/** Stable, human-readable idempotency key for the ledger row a capture line produces. */
export function ledgerDedupeKey(lineId: string): string {
  return `capture:${lineId}`
}

/**
 * A line posts money only when it is a money line that a person has not excluded.
 * Quantity-only rows (jars, miles) are recorded on the capture for reporting but carry no dollars,
 * so they never reach the ledger.
 */
export function isPostable(line: Pick<FormCaptureLine, 'excluded' | 'amountCents'>): boolean {
  return !line.excluded && line.amountCents > 0
}

/** The description that will appear on the QuickBooks journal line. */
export function buildDescription(
  capture: Pick<FormCapture, 'formType'>,
  line: Pick<FormCaptureLine, 'label'>,
  subject: string | null
): string {
  const readable = capture.formType.toLowerCase().replace(/_/g, ' ')
  return subject ? `${subject} — ${line.label}` : `${readable} — ${line.label}`
}

export interface PostResult {
  postedLineIds: string[]
  skippedLineIds: string[]
  ledgerEntryIds: string[]
}

/**
 * Write the ledger rows for an approved capture and mark it POSTED.
 *
 * Runs in a single transaction: a capture is either fully posted or not posted at all, so a
 * partial failure can be retried without leaving half a show's takings in the books.
 *
 * Once the rows exist, the QuickBooks side needs no new code — `enqueueLedgerEntries` already
 * sweeps up ledger rows that carry money QuickBooks has not seen.
 */
export async function postCaptureToLedger(captureId: string): Promise<PostResult> {
  const capture = await prisma.formCapture.findUnique({
    where: { id: captureId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })

  if (!capture) throw new Error(`Capture ${captureId} not found`)
  if (capture.status === 'POSTED') {
    // Idempotent by design: asking twice is not an error, it just does nothing the second time.
    return {
      postedLineIds: [],
      skippedLineIds: capture.lines.map((line) => line.id),
      ledgerEntryIds: capture.lines.flatMap((line) => (line.ledgerEntryId ? [line.ledgerEntryId] : [])),
    }
  }
  if (capture.status !== 'APPROVED') {
    throw new Error(`Capture ${captureId} is ${capture.status}; only an APPROVED capture can post.`)
  }

  const subject = readSubject(capture.rawExtraction)
  // Fall back to the upload date only when the form itself carried no date — the accounting date
  // should be the day the money moved, which is what is written on the page.
  const accountingDate = capture.capturedOn ?? capture.uploadedAt
  const channel = CHANNEL_BY_FORM_TYPE[capture.formType] ?? 'MANUAL'

  const postedLineIds: string[] = []
  const skippedLineIds: string[] = []
  const ledgerEntryIds: string[] = []

  await prisma.$transaction(async (tx) => {
    for (const line of capture.lines) {
      if (!isPostable(line) || line.ledgerEntryId) {
        skippedLineIds.push(line.id)
        continue
      }

      const entry = await tx.ledgerEntry.upsert({
        where: { dedupeKey: ledgerDedupeKey(line.id) },
        create: {
          date: accountingDate,
          direction: line.direction,
          amountCents: line.amountCents,
          category: line.category,
          source: 'FORM_CAPTURE',
          sourceId: capture.id,
          dedupeKey: ledgerDedupeKey(line.id),
          description: buildDescription(capture, line, subject),
          counterparty: subject,
          channel,
          memo: `Read from photographed form ${capture.id}`,
          isManual: false,
          enteredById: capture.reviewedById ?? capture.uploadedById,
        },
        update: {
          date: accountingDate,
          direction: line.direction,
          amountCents: line.amountCents,
          category: line.category,
          description: buildDescription(capture, line, subject),
        },
      })

      await tx.formCaptureLine.update({
        where: { id: line.id },
        data: { ledgerEntryId: entry.id },
      })

      postedLineIds.push(line.id)
      ledgerEntryIds.push(entry.id)
    }

    await tx.formCapture.update({
      where: { id: capture.id },
      data: { status: 'POSTED', postedAt: new Date() },
    })
  })

  return { postedLineIds, skippedLineIds, ledgerEntryIds }
}

/** Pull the subject the extractor recorded out of the stored raw output, defensively. */
function readSubject(raw: Prisma.JsonValue | null): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = (raw as Record<string, unknown>).subject
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
