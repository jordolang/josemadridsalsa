import type { CaptureFormType, LedgerCategory, LedgerDirection } from '@prisma/client'

/**
 * One money line as the extractor reports it, before it becomes a `FormCaptureLine`.
 *
 * `rawValue` is deliberately kept alongside `amountCents`: handwriting is the input, so the
 * number a person later disputes has to be traceable to the characters the model believed it saw.
 */
export interface ExtractedLine {
  label: string
  amountCents: number
  quantity: number | null
  confidence: number
  rawValue: string | null
}

/** The full result of reading one form. */
export interface ExtractionResult {
  formType: CaptureFormType
  capturedOn: Date | null
  /** Venue / destination / vendor, whichever the form names. Used to match an event. */
  subject: string | null
  statedTotalCents: number | null
  lines: ExtractedLine[]
  /** The model id that produced this, recorded so a re-read can be compared. */
  model: string
  /** Unedited model output, stored for audit. */
  raw: unknown
}

/** A line after classification, ready to be persisted. */
export interface ClassifiedLine extends ExtractedLine {
  direction: LedgerDirection
  category: LedgerCategory
}

export interface ReconcileResult {
  /** Null when the form stated no total — nothing to reconcile against. */
  reconciled: boolean | null
  /** Signed cents: stated total minus the sum of income lines. Zero when they agree. */
  deltaCents: number
}
