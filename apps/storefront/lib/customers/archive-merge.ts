/**
 * Merge of the raw contact records extracted from the `Documents/` business
 * archive (stage 1: `scripts/extract-archive-customers.py`) into one row per
 * email address.
 *
 * The archive's sources overlap heavily — the same person shows up in a
 * BigCommerce customer export, a Constant Contact list, an order export and a
 * fundraiser order form — so every rule here is deliberately
 * **order-independent**: feeding the same records in a different sequence must
 * produce the same customer. That matters most for `emailStatus`, where a
 * last-write-wins merge would silently resurrect an unsubscribed contact as
 * mailable.
 */

export type ArchiveSignal = 'standard' | 'fundraising' | 'wholesale' | 'mixed'

export type CustomerAccountType = 'STANDARD' | 'FUNDRAISING' | 'WHOLESALE'

/** One extracted record: an email as it appeared in one source file. */
export interface RawArchiveContact {
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  company: string | null
  group: string | null
  emailStatus: string | null
  emailPermissionStatus: string | null
  sourceName: string | null
  orders: string | null
  orderTotal: string | null
  orderDate: string | null
  createdAt: string | null
  customerType: string | null
  city: string | null
  state: string | null
  sourceFile: string
  mode: string
  signal: ArchiveSignal
}

export interface MergedArchiveCustomer {
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  emailStatus: string | null
  emailPermissionStatus: string | null
  sourceName: string | null
  accountType: CustomerAccountType
  notes: string
  totalOrders: number
  totalSpent: number
  lastOrderAt: Date | null
  /** Every archive file this address was found in, for the audit trail. */
  sourceFiles: string[]
  /** All designations the evidence supported, before precedence was applied. */
  signals: ArchiveSignal[]
}

// --------------------------------------------------------------------------
// Designation
// --------------------------------------------------------------------------

/**
 * A file signal of `mixed` means the extractor could not tell from the file
 * alone (a QuickBooks dump holds retail individuals and wholesale accounts side
 * by side) and fell back to per-row evidence, which it already resolved to
 * standard or wholesale. Anything still `mixed` here is treated as standard.
 */
const ACCOUNT_TYPE_PRECEDENCE: Record<ArchiveSignal, number> = {
  wholesale: 3,
  fundraising: 2,
  standard: 1,
  mixed: 0,
}

const SIGNAL_TO_ACCOUNT_TYPE: Record<ArchiveSignal, CustomerAccountType> = {
  wholesale: 'WHOLESALE',
  fundraising: 'FUNDRAISING',
  standard: 'STANDARD',
  mixed: 'STANDARD',
}

/**
 * A wholesale account that also ran a fundraiser is still a wholesale account —
 * the stronger commercial relationship wins. Every signal is recorded in the
 * notes regardless, so a different ordering can be re-derived without re-running
 * the extraction.
 */
export function designate(signals: ArchiveSignal[]): CustomerAccountType {
  let best: ArchiveSignal = 'standard'
  for (const s of signals) {
    if (ACCOUNT_TYPE_PRECEDENCE[s] > ACCOUNT_TYPE_PRECEDENCE[best]) best = s
  }
  return SIGNAL_TO_ACCOUNT_TYPE[best]
}

// --------------------------------------------------------------------------
// Email status
// --------------------------------------------------------------------------

/**
 * Constant Contact spellings, most restrictive first. An unsubscribe is never
 * overridden by a later "Active" row from an older export.
 */
const EMAIL_STATUS_RANK = [
  'Unsubscribed',
  'Removed',
  'Suppressed',
  'Bounced',
  'Pending',
  'Active',
  'Implied',
] as const

function canonicalStatus(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  for (const known of EMAIL_STATUS_RANK) {
    if (v === known.toLowerCase()) return known
  }
  if (v.startsWith('unsub') || v === 'opt out' || v === 'optout') return 'Unsubscribed'
  if (v.startsWith('bounce')) return 'Bounced'
  if (v.startsWith('remov') || v.startsWith('delet')) return 'Removed'
  if (v.startsWith('suppress')) return 'Suppressed'
  return null
}

/** Most restrictive status across every source wins, whatever the order. */
export function mergeEmailStatus(values: (string | null)[]): string | null {
  let best: string | null = null
  let bestRank = Number.POSITIVE_INFINITY
  for (const v of values) {
    if (!v) continue
    const canon = canonicalStatus(v)
    if (!canon) continue
    const rank = EMAIL_STATUS_RANK.indexOf(canon as (typeof EMAIL_STATUS_RANK)[number])
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank
      best = canon
    }
  }
  return best
}

// --------------------------------------------------------------------------
// Field merge
// --------------------------------------------------------------------------

/**
 * The value that the most sources agree on. Ties break toward the longer value
 * (an abbreviated "H" loses to "Herlocher") and then lexicographically, so the
 * result never depends on input order.
 */
export function pickField(values: (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) {
    const t = v?.trim()
    if (!t) continue
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  if (counts.size === 0) return null

  let best: string | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (
      best === null ||
      count > bestCount ||
      (count === bestCount &&
        (value.length > best.length ||
          (value.length === best.length && value < best)))
    ) {
      best = value
      bestCount = count
    }
  }
  return best
}

// --------------------------------------------------------------------------
// Dates
// --------------------------------------------------------------------------

export type DateOrder = 'MDY' | 'DMY'

const SLASH_DATE_RE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Which way round a file writes `04/13/2026`. The BigCommerce exports in the
 * archive disagree — the same record's join date is `04/20/2020` in one export
 * and `20/04/2020` in another — so the order has to be decided per file from
 * whichever component is unambiguously > 12.
 */
export function detectDateOrder(samples: string[]): DateOrder {
  let dayFirst = 0
  let monthFirst = 0
  for (const s of samples) {
    const m = SLASH_DATE_RE.exec(s.trim())
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 12 && b <= 12) dayFirst++
    else if (b > 12 && a <= 12) monthFirst++
  }
  if (dayFirst > monthFirst) return 'DMY'
  return 'MDY'
}

/** Parses an archive date string, or null if it isn't a usable date. */
export function parseArchiveDate(raw: string | null, order: DateOrder): Date | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  const iso = ISO_DATE_RE.exec(s)
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    return isSaneDate(d) ? d : null
  }

  const m = SLASH_DATE_RE.exec(s)
  if (!m) return null
  let day = order === 'DMY' ? Number(m[1]) : Number(m[2])
  let month = order === 'DMY' ? Number(m[2]) : Number(m[1])
  // A file detected as one order can still hold a row written the other way.
  if (month > 12 && day <= 12) [day, month] = [month, day]
  let year = Number(m[3])
  if (year < 100) year += year < 70 ? 2000 : 1900
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  return isSaneDate(d) ? d : null
}

function isSaneDate(d: Date): boolean {
  if (Number.isNaN(d.getTime())) return false
  const year = d.getUTCFullYear()
  return year >= 1995 && year <= 2100
}

function parseMoney(raw: string | null): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseCount(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw.replace(/[,\s]/g, ''))
  return Number.isInteger(n) && n >= 0 && n < 100000 ? n : null
}

/**
 * Order-form cells and stray "Organization:" labels leave values like ":" or
 * "N/A" behind; those must not become a customer's displayed source name.
 */
export function isUsableOrgName(value: string | undefined | null): value is string {
  if (!value) return false
  const v = value.trim()
  if (v.length < 2 || v.length > 120) return false
  if (!/[A-Za-z]{2}/.test(v)) return false
  return !/^(n\/?a|none|tbd|unknown|test|na)$/i.test(v)
}

// --------------------------------------------------------------------------
// Notes / audit trail
// --------------------------------------------------------------------------

const MAX_LISTED_SOURCES = 12

function buildNotes(
  accountType: CustomerAccountType,
  signals: ArchiveSignal[],
  groups: string[],
  sourceFiles: string[],
  importedOn: string
): string {
  const parts = [`Document archive import ${importedOn}.`]
  parts.push(
    `Designated ${accountType}` +
      (signals.length > 1 ? ` (evidence: ${signals.join(', ')}).` : '.')
  )
  if (groups.length > 0) {
    parts.push(`Organization(s): ${groups.slice(0, 8).join('; ')}.`)
  }
  const listed = sourceFiles.slice(0, MAX_LISTED_SOURCES)
  const extra = sourceFiles.length - listed.length
  parts.push(
    `Found in ${sourceFiles.length} archive file(s): ${listed.join('; ')}` +
      (extra > 0 ? `; +${extra} more.` : '.')
  )
  return parts.join(' ')
}

// --------------------------------------------------------------------------
// Merge
// --------------------------------------------------------------------------

export interface MergeOptions {
  /** Date stamped into the notes line; defaults to today (UTC, YYYY-MM-DD). */
  importedOn?: string
}

export function mergeArchiveContacts(
  records: RawArchiveContact[],
  options: MergeOptions = {}
): MergedArchiveCustomer[] {
  const importedOn =
    options.importedOn ?? new Date().toISOString().slice(0, 10)

  // Resolve each file's date convention once, from every date it contains.
  const samplesByFile = new Map<string, string[]>()
  for (const r of records) {
    const list = samplesByFile.get(r.sourceFile) ?? []
    if (r.createdAt) list.push(r.createdAt)
    if (r.orderDate) list.push(r.orderDate)
    if (list.length > 0) samplesByFile.set(r.sourceFile, list)
  }
  const orderByFile = new Map<string, DateOrder>()
  for (const [file, samples] of samplesByFile) {
    orderByFile.set(file, detectDateOrder(samples))
  }

  const groups = new Map<string, RawArchiveContact[]>()
  for (const r of records) {
    const email = r.email.trim().toLowerCase()
    if (!email) continue
    const list = groups.get(email)
    if (list) list.push(r)
    else groups.set(email, [r])
  }

  const out: MergedArchiveCustomer[] = []
  for (const [email, rows] of groups) {
    const signals = [...new Set(rows.map((r) => r.signal))]
      .filter((s) => s !== 'mixed')
      .sort()
    const accountType = designate(rows.map((r) => r.signal))

    const orgs = [
      ...new Set(
        rows
          .flatMap((r) => [r.group, r.company])
          .map((v) => v?.trim())
          .filter(isUsableOrgName)
      ),
    ].sort()

    // The same order appearing in two exports of the same store must count
    // once, so contributions are keyed on the order itself rather than the row.
    const orderKeys = new Set<string>()
    let totalSpent = 0
    let lastOrderAt: Date | null = null
    for (const r of rows) {
      const order = orderByFile.get(r.sourceFile) ?? 'MDY'
      const date = parseArchiveDate(r.orderDate, order)
      const amount = parseMoney(r.orderTotal)
      if (!date && amount === null) continue
      const key = `${date ? date.toISOString().slice(0, 10) : '?'}|${amount ?? '?'}`
      if (orderKeys.has(key)) continue
      orderKeys.add(key)
      if (amount !== null && amount > 0) totalSpent += amount
      if (date && (!lastOrderAt || date > lastOrderAt)) lastOrderAt = date
    }

    // BigCommerce exports carry an authoritative per-customer order count;
    // otherwise fall back to the distinct orders we could reconstruct.
    const reportedOrders = rows
      .map((r) => parseCount(r.orders))
      .filter((n): n is number => n !== null)
    const totalOrders = Math.max(0, ...reportedOrders, orderKeys.size)

    const sourceFiles = [...new Set(rows.map((r) => r.sourceFile))].sort()

    out.push({
      email,
      firstName: pickField(rows.map((r) => r.firstName)),
      lastName: pickField(rows.map((r) => r.lastName)),
      phone: pickField(rows.map((r) => r.phone)),
      emailStatus: mergeEmailStatus(rows.map((r) => r.emailStatus)),
      emailPermissionStatus: pickField(rows.map((r) => r.emailPermissionStatus)),
      // The fundraiser group or wholesale company is far more useful on the
      // customer list than Constant Contact's "Added by you".
      sourceName: orgs[0] ?? pickField(rows.map((r) => r.sourceName)),
      accountType,
      notes: buildNotes(accountType, signals, orgs, sourceFiles, importedOn),
      totalOrders,
      totalSpent: Math.round(totalSpent * 100) / 100,
      lastOrderAt,
      sourceFiles,
      signals,
    })
  }

  out.sort((a, b) => (a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
  return out
}
