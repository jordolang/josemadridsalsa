import type { CaptureStatus } from '@prisma/client'
import type { ClassifiedLine, ReconcileResult } from './types'

/**
 * A line must be at least this confident, and the form must reconcile, for the capture to skip
 * human review. Set high on purpose: the cost of a wrong figure reaching QuickBooks is far higher
 * than the cost of one extra glance at a photo.
 */
export const AUTO_APPROVE_MIN_CONFIDENCE = 0.9

/**
 * Cents of slack allowed between a form's stated total and the sum of its income lines.
 * Zero: these forms are added up by hand, and a mismatch is exactly the signal worth surfacing.
 */
export const RECONCILE_TOLERANCE_CENTS = 0

/**
 * Read a handwritten money figure into cents.
 *
 * Built against what the archive actually contains: `$1,234.50`, `1234`, `1,234.-`, `$ 87.00`,
 * bare dashes for "none", and the occasional trailing note. Returns null when there is no number,
 * which the caller must treat as "unreadable", never as zero.
 */
export function parseMoneyToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    return Math.round(raw * 100)
  }

  const trimmed = raw.trim()
  if (!trimmed) return null

  // A lone dash (or em/en dash) is the bookkeeper's "nothing here", which is a real zero.
  if (/^[-‒-―−]+$/.test(trimmed)) return 0

  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith('-')

  // Keep digits, separators and the decimal point; drop currency marks, spaces and trailing prose.
  const match = trimmed.match(/-?[\d,]*\.?\d+/)
  if (!match) return null

  const cleaned = match[0].replace(/,/g, '').replace(/^-/, '')
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value)) return null

  const cents = Math.round(value * 100)
  return negative ? -cents : cents
}

/**
 * Read a whole-number quantity (jars, miles). Rejects anything fractional-looking beyond rounding,
 * because a fractional jar count means the extractor misread the cell.
 */
export function parseQuantity(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null

  const trimmed = raw.trim()
  if (!trimmed) return null
  const match = trimmed.match(/\d[\d,]*(\.\d+)?/)
  if (!match) return null

  const value = Number.parseFloat(match[0].replace(/,/g, ''))
  return Number.isFinite(value) ? Math.round(value) : null
}

/**
 * Read a date written on a form. Handles the two orders that appear in the archive (`4/13/26`
 * and `2026-04-13`) and the two-digit years the forms are full of.
 *
 * Ambiguous day/month pairs are resolved US-style (month first), which is how every form in the
 * archive is written. Returns null rather than guessing at anything else.
 */
export function parseFormDate(raw: string | null | undefined, now = new Date()): Date | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // ISO first — unambiguous, so it never reaches the US-order branch below.
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return buildUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const slash = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/)
  if (slash) {
    const month = Number(slash[1])
    const day = Number(slash[2])
    let year = Number(slash[3])
    if (year < 100) {
      // Two-digit years on these forms are always recent and never in the future.
      const century = Math.floor(now.getUTCFullYear() / 100) * 100
      year += century
      if (year > now.getUTCFullYear()) year -= 100
    }
    return buildUtcDate(year, month, day)
  }

  return null
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejects impossible dates that JS would otherwise roll forward (e.g. 2/30 -> 3/2).
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

/**
 * Compare the total printed on the form against the sum of its income lines.
 *
 * Only income is summed. A show sheet's total is takings; the booth fee written in the corner is
 * an expense that was never part of that total, and including it would manufacture a mismatch.
 */
export function reconcile(
  lines: ClassifiedLine[],
  statedTotalCents: number | null
): ReconcileResult {
  const incomeSum = lines
    .filter((line) => line.direction === 'INCOME')
    .reduce((sum, line) => sum + line.amountCents, 0)

  if (statedTotalCents === null) return { reconciled: null, deltaCents: 0 }

  const deltaCents = statedTotalCents - incomeSum
  return {
    reconciled: Math.abs(deltaCents) <= RECONCILE_TOLERANCE_CENTS,
    deltaCents,
  }
}

/**
 * Decide where a freshly-read form lands: straight to APPROVED, or into the review queue.
 *
 * A form skips review only when every line was read confidently *and* the arithmetic on the page
 * agrees with the lines. Anything else is a person's call — which is the whole point: the reviewer
 * only ever sees the forms the machine could not settle on its own.
 */
export function decideStatus(input: {
  lines: ClassifiedLine[]
  reconciled: boolean | null
  minConfidence?: number
}): CaptureStatus {
  const { lines, reconciled } = input
  if (lines.length === 0) return 'NEEDS_REVIEW'

  const threshold = input.minConfidence ?? AUTO_APPROVE_MIN_CONFIDENCE
  const lowest = Math.min(...lines.map((line) => line.confidence))
  if (lowest < threshold) return 'NEEDS_REVIEW'

  // A stated total that disagrees with the lines is the single most valuable thing to surface.
  if (reconciled === false) return 'NEEDS_REVIEW'

  return 'APPROVED'
}

/** Lowest confidence across the lines, or null when there are none. */
export function lowestConfidence(lines: ClassifiedLine[]): number | null {
  if (lines.length === 0) return null
  return Math.min(...lines.map((line) => line.confidence))
}
