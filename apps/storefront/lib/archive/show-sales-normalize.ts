/**
 * Normalizes the raw show/market sales rows from
 * `scripts/extract-show-sales.py` into `ArchivedShowSale` rows and de-duplicates
 * the overlapping yearly sheets. The one genuinely fiddly bit — turning a date
 * cell that is often a range like "1/3-5/2025" into the show's start date — lives
 * here and is unit-tested.
 */

import { createHash } from 'node:crypto'

export type ShowEventType = 'SHOW' | 'FARMERS_MARKET'

export interface RawShowSale {
  sourceFile: string
  sourceMd5: string
  sourceRow: number
  year: number | null
  eventType: ShowEventType
  showName: string
  dateText: string | null
  dateIso: string | null
  sales: number | string | null
  amountPaid?: number | string | null
  expenses?: number | string | null
  person: string | null
}

export interface NormalizedShowSale {
  showName: string
  showDate: string | null
  dateText: string | null
  year: number | null
  eventType: ShowEventType
  sales: number | null
  amountPaid: number | null
  expenses: number | null
  salesPerson: string | null
  sourceFile: string
  sourceMd5: string
  sourceRow: number
  contentHash: string
}

export function parseMoney(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = v.replace(/[$,]/g, '').replace(/[^0-9.\-]/g, '').trim()
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Resolve the event's start date. A real date cell wins; otherwise parse the
 * text form, which is usually a range: "1/3-5/2025" -> 2025-01-03,
 * "1/25-27/2025" -> 2025-01-25, "1/12/2025" -> 2025-01-12.
 */
export function parseShowDate(
  dateIso: string | null,
  dateText: string | null
): string | null {
  if (dateIso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
  }
  if (dateText) {
    const m = /^(\d{1,2})\/(\d{1,2})(?:\s*-\s*\d{1,2})?\/(\d{2,4})/.exec(dateText.trim())
    if (m) {
      const month = m[1].padStart(2, '0')
      const day = m[2].padStart(2, '0')
      const year = m[3].length === 2 ? `20${m[3]}` : m[3]
      if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
        return `${year}-${month}-${day}`
      }
    }
  }
  return null
}

const PERSON_ALIASES: Record<string, string> = {
  deb: 'Debbie',
  debbie: 'Debbie',
  mike: 'Mike',
  matt: 'Matt',
  stan: 'Stan',
  mindy: 'Mindy',
}

/** Trim/canonicalize a crew name; compound names ("Matt/Stan") are kept as-is. */
export function canonicalizePerson(v: string | null): string | null {
  if (!v) return null
  const s = v.trim()
  if (!s) return null
  if (s.includes('/')) return s // compound crew, leave alone
  const key = s.toLowerCase().replace(/\s+\w$/, '').trim() // drop a trailing initial ("Stan L")
  if (PERSON_ALIASES[key]) return PERSON_ALIASES[key]
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

export function computeShowContentHash(
  e: Pick<NormalizedShowSale, 'year' | 'eventType' | 'showName' | 'showDate' | 'dateText' | 'sales'>
): string {
  const key = [
    e.year ?? '',
    e.eventType,
    e.showName.toLowerCase().replace(/\s+/g, ' ').trim(),
    e.showDate ?? e.dateText ?? '',
    e.sales ?? '',
  ].join('|')
  return createHash('sha256').update(key).digest('hex').slice(0, 32)
}

export function normalizeShowSaleRow(
  raw: RawShowSale
): NormalizedShowSale | null {
  const showName = raw.showName?.trim()
  if (!showName) return null

  const showDate = parseShowDate(raw.dateIso, raw.dateText)
  const year = raw.year ?? (showDate ? Number(showDate.slice(0, 4)) : null)
  const base = {
    showName,
    showDate,
    dateText: raw.dateIso ? null : raw.dateText,
    year,
    eventType: raw.eventType,
    sales: parseMoney(raw.sales),
    amountPaid: parseMoney(raw.amountPaid),
    expenses: parseMoney(raw.expenses),
    salesPerson: canonicalizePerson(raw.person),
    sourceFile: raw.sourceFile,
    sourceMd5: raw.sourceMd5,
    sourceRow: raw.sourceRow,
  }
  return { ...base, contentHash: computeShowContentHash(base) }
}

export interface ShowSalesSummary {
  entries: NormalizedShowSale[]
  duplicatesDropped: number
  skipped: number
}

export function normalizeShowSales(rows: RawShowSale[]): ShowSalesSummary {
  const byHash = new Map<string, NormalizedShowSale>()
  let duplicatesDropped = 0
  let skipped = 0
  for (const raw of rows) {
    const n = normalizeShowSaleRow(raw)
    if (!n) {
      skipped++
      continue
    }
    if (byHash.has(n.contentHash)) {
      duplicatesDropped++
      continue
    }
    byHash.set(n.contentHash, n)
  }
  return { entries: [...byHash.values()], duplicatesDropped, skipped }
}
