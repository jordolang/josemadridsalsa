/**
 * Classification for the document-archive index: how sensitive a file is, and
 * which year it belongs to. Kept pure and unit-tested because the sensitivity
 * verdict is a security boundary — it decides which archive files may surface on
 * public or customer-facing routes (only `PUBLIC`/`INTERNAL`) versus which are
 * gated to privileged admin views (`SENSITIVE`: HR, taxes, bank, payroll).
 */

export type ArchiveSensitivity = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE'

/** Top-level archive folders whose every file is sensitive by default. */
const SENSITIVE_CATEGORIES = new Set(['02 Taxes', '10 People & HR'])

/** Sub-paths under `01 Financial` that hold account-level records. */
const SENSITIVE_FINANCIAL_SUBPATHS = [
  'bank statements',
  'banking',
  'billing statements',
  'pos & 1099-k',
  'loans',
]

/**
 * Filename/path substrings that make a file sensitive regardless of folder —
 * personal identifiers and tax/payroll instruments that must never leak. Matched
 * case-insensitively against the whole relative path.
 */
const SENSITIVE_KEYWORDS = [
  'child support',
  'ssn',
  'social security',
  'w-2',
  'w2 ',
  'w-9',
  '1099',
  '1098',
  'payroll',
  'direct deposit',
  'void check',
  'voided check',
  'routing number',
  'account number',
  'resume',
  'transcript',
  'ui income',
  'unemployment',
  'bank statement',
  // QuickBooks Desktop company files and backups. A single one of these holds
  // the entire general ledger — payroll, bank accounts, every customer — so it
  // is sensitive wherever it is filed.
  '.qbw',
  '.qbb',
]

/**
 * Decide a file's sensitivity from its archive path and category. Defaults to
 * INTERNAL — nothing is treated as public unless a caller later promotes it.
 */
/**
 * Identifiers that make a document sensitive regardless of where it is filed.
 * Path and category alone miss these: a Social Security number turned up in
 * `12 Correspondence/Dear Sirs.docx`, a category no rule treats as sensitive.
 */
const SENSITIVE_CONTENT_PATTERNS: RegExp[] = [
  // SSN, written out. Deliberately not a bare 9-digit run — order numbers,
  // UPCs and phone numbers would swamp it with false positives.
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:social security (?:number|no|#)|SSN)\b\s*[:#]?\s*\d/i,
]

export function classifySensitivity(
  relPath: string,
  category: string,
  /** Extracted text, when available. Content can make a document sensitive
   *  even when its path and category do not. */
  extractedText?: string | null
): ArchiveSensitivity {
  const lower = relPath.toLowerCase()

  if (SENSITIVE_CATEGORIES.has(category)) return 'SENSITIVE'

  if (category === '01 Financial') {
    for (const sub of SENSITIVE_FINANCIAL_SUBPATHS) {
      if (lower.includes(`/${sub}/`) || lower.includes(`${sub}/`)) return 'SENSITIVE'
    }
  }

  for (const kw of SENSITIVE_KEYWORDS) {
    if (lower.includes(kw)) return 'SENSITIVE'
  }

  if (extractedText) {
    for (const pattern of SENSITIVE_CONTENT_PATTERNS) {
      if (pattern.test(extractedText)) return 'SENSITIVE'
    }
  }

  return 'INTERNAL'
}

/**
 * The year the archive filed a document under, taken from a `YYYY` path segment
 * (the archive organizes Financial/Taxes/Fundraisers/Shows by year). Returns the
 * first plausible year segment, or null when the file is not filed by year.
 */
export function parseArchiveYear(relPath: string): number | null {
  for (const segment of relPath.split('/')) {
    if (/^(19|20)\d{2}$/.test(segment.trim())) {
      const year = Number(segment.trim())
      if (year >= 1990 && year <= 2030) return year
    }
  }
  return null
}
