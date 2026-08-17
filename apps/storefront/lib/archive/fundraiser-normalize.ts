/**
 * Normalizes the raw fundraiser order-form records from
 * `scripts/extract-fundraisers.py` into `ArchivedFundraiser` summaries.
 *
 * The messy parts — resolving an organization name from a store-export group vs
 * a form label vs the folder vs a dated filename, parsing the free-text form
 * date, and dropping Jose Madrid's own email off the template (the "E-Mail:"
 * label on the blank template is the business's, not the organizer's) — live
 * here and are unit-tested.
 */

export type FundraiserFormType = 'ORDER_EXPORT' | 'ORDER_FORM' | 'UNKNOWN'

export interface RawFundraiser {
  sourceFile: string
  sourceMd5: string
  year: number | null
  folderOrg: string | null
  fileBase: string
  shape: FundraiserFormType
  // ORDER_EXPORT
  orderCount?: number | null
  totalJars?: number | null
  dateMin?: string | null
  dateMax?: string | null
  groupName?: string | null
  // ORDER_FORM
  labels?: Record<string, string>
  flavors?: Record<string, number>
}

export interface NormalizedFundraiser {
  organizationName: string
  year: number | null
  orderDate: string | null
  submittedBy: string | null
  contactEmail: string | null
  contactPhone: string | null
  formType: FundraiserFormType
  totalJars: number | null
  orderCount: number | null
  flavorsJson: Record<string, number> | null
  sourceFile: string
  sourceMd5: string
  notes: string | null
}

/** Folder names that are template buckets, not real organizations. */
const TEMPLATE_FOLDERS = new Set(['$6.00 forms', '8$ forms', 'qr', 'email lists'])

const BUSINESS_EMAIL = /@(josemadridsalsa\.com|josemadrid\.net)\b/i

export function isBusinessEmail(email: string | null | undefined): boolean {
  return !!email && BUSINESS_EMAIL.test(email)
}

/** Every flavor on the JMS order-form template carries a heat level. */
const HEAT_LEVEL = /\b(mild|medium|hot|x-?hot|extra hot)\b/i

/**
 * Whether a form's quantity columns are really salsa flavors.
 *
 * The extractor finds the quantity columns positionally, so on a multi-campaign
 * *tracking* sheet it latches onto whatever that sheet lists down the side —
 * coordinator names ("Randy", "Cheryl", "Mandy Boyd") — and reads their running
 * jar totals as if they were one campaign's flavor quantities. The two shapes
 * separate cleanly: real order forms name a heat level on essentially every
 * column, tracking sheets on none.
 */
export function looksLikeSalsaFlavors(flavors: Record<string, number>): boolean {
  const keys = Object.keys(flavors)
  if (keys.length === 0) return false
  const withHeat = keys.filter((k) => HEAT_LEVEL.test(k)).length
  return withHeat / keys.length >= 0.5
}

/**
 * Strip the dated/keyword noise off a filename-derived org name:
 * "Morgan hs marching band 5-20-24" -> "Morgan hs marching band",
 * "Oak Harbor Marine Science Order (2024)" -> "Oak Harbor Marine Science".
 */
export function cleanOrgName(raw: string): string {
  let s = raw.trim()
  s = s.replace(/\s*\((?:19|20)\d{2}\)\s*$/, '') // trailing (2024)
  // Peel trailing tokens: dates, keywords, bare years — repeatedly.
  let prev: string
  do {
    prev = s
    s = s.replace(/\s+\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\s*$/, '') // 10-14-24
    s = s.replace(/\s+(?:order|orders|sales|final|po|form|forms|flier|flyer|fundraiser|fr|sale)\b\.?\s*$/i, '')
    s = s.replace(/\s+'?(?:19|20)?\d{2}\s*$/, (m) => (/\d{4}/.test(m) || /'\d{2}/.test(m) ? '' : m))
    s = s.trim()
  } while (s !== prev && s.length > 0)
  return s.replace(/\s{2,}/g, ' ').trim() || raw.trim()
}

/** Parse a form date cell: MM/DD/YYYY, "Month D, YYYY", or ISO. */
export function parseFormDate(value: string | null | undefined): string | null {
  if (!value) return null
  const s = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s)
  if (mdy) {
    const [, m, d, y] = mdy
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05',
    june: '06', july: '07', august: '08', september: '09', october: '10',
    november: '11', december: '12',
  }
  const words = /^([A-Za-z]+)\s+(\d{1,2}),?\s+((?:19|20)\d{2})$/.exec(s)
  if (words) {
    const mm = months[words[1].toLowerCase()]
    if (mm) return `${words[3]}-${mm}-${words[2].padStart(2, '0')}`
  }
  return null
}

function resolveOrgName(raw: RawFundraiser): string {
  if (raw.shape === 'ORDER_EXPORT' && raw.groupName) return raw.groupName.trim()
  const label = raw.labels?.organization?.trim()
  if (label) return label
  if (raw.folderOrg && !TEMPLATE_FOLDERS.has(raw.folderOrg.toLowerCase())) {
    return raw.folderOrg.trim()
  }
  return cleanOrgName(raw.fileBase)
}

export function normalizeFundraiser(raw: RawFundraiser): NormalizedFundraiser {
  const organizationName = resolveOrgName(raw)

  const orderDate =
    raw.shape === 'ORDER_EXPORT'
      ? (raw.dateMax ?? raw.dateMin ?? null)?.slice(0, 10) ?? null
      : parseFormDate(raw.labels?.date)

  const email = raw.labels?.['e-mail'] ?? raw.labels?.email ?? null
  const contactEmail = email && !isBusinessEmail(email) ? email.trim().toLowerCase() : null

  const flavors = raw.flavors && Object.keys(raw.flavors).length > 0 ? raw.flavors : null
  const isEmptyTemplate =
    raw.shape === 'ORDER_FORM' && !raw.labels?.organization && !flavors && !raw.totalJars

  // A tracking sheet rolls up many campaigns, so its totals belong to no single
  // one. Recording it as an order form both invents a campaign and inflates the
  // jar count by orders of magnitude, so surface it as UNKNOWN without figures.
  const isAggregateSheet =
    raw.shape === 'ORDER_FORM' && !!flavors && !looksLikeSalsaFlavors(flavors)

  const year = raw.year ?? (orderDate ? Number(orderDate.slice(0, 4)) : null)

  return {
    organizationName,
    year,
    orderDate,
    submittedBy: raw.labels?.['submitted by']?.trim() ?? null,
    contactEmail,
    contactPhone: raw.labels?.phone?.replace(/[^0-9]/g, '').trim() || null,
    formType: isAggregateSheet ? 'UNKNOWN' : raw.shape,
    totalJars: isAggregateSheet ? null : raw.totalJars ?? null,
    orderCount: isAggregateSheet ? null : raw.orderCount ?? null,
    flavorsJson: isAggregateSheet ? null : flavors,
    sourceFile: raw.sourceFile,
    sourceMd5: raw.sourceMd5,
    notes: isEmptyTemplate
      ? 'Blank order-form template (no org or quantities)'
      : isAggregateSheet
        ? 'Multi-campaign tracking sheet — totals span many fundraisers, not recorded'
        : null,
  }
}
