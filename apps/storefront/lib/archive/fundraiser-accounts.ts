/**
 * Fundraiser account normalization.
 *
 * Turns `ArchivedFundraiser` rows — one per source spreadsheet — into the
 * distinct organizations behind them. The same group appears once per campaign
 * and per year ("BGSU Equestrian", "BGSU Equestrian Fall '21", "BGSU Equestrian
 * Team 2022"), and a handful of rows are filing artifacts rather than
 * organizations at all, so both have to be resolved before anything is stored.
 */

/** One archived campaign row, narrowed to the fields an account needs. */
export interface ArchivedFundraiserRow {
  organizationName: string
  contactEmail: string | null
  submittedBy: string | null
  year: number | null
  orderDate: Date | null
  sourceFile: string
}

/** A distinct organization, merged across every campaign it ran. */
export interface FundraiserAccount {
  /** Canonical display name, year and season suffixes removed. */
  organizationName: string
  /** Lowercased contact address; null when no campaign recorded one. */
  email: string | null
  firstName: string | null
  lastName: string | null
  /** Every year this organization has a campaign for, ascending. */
  years: number[]
  campaignCount: number
  sourceFiles: string[]
}

/**
 * The 0x80-0x9F slots where cp1252 differs from Latin-1. UTF-8 read as cp1252
 * is what produces "â€™" for a curly apostrophe, so undoing it needs this
 * mapping rather than a plain charCode mask.
 */
const CP1252_HIGH: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

/**
 * Repair UTF-8 that was decoded as cp1252 somewhere upstream, which turns a
 * curly apostrophe into "â€™" ("Brealynn Gardnerâ€™s Rodeo").
 *
 * Returns the input unchanged unless the whole string round-trips as valid
 * UTF-8 — a partial or speculative fix would corrupt real text.
 */
export function repairMojibake(value: string): string {
  if (!/[ÂÃâãð][-¿–—‘-”†-™Œ-ž]/.test(value)) {
    return value
  }

  const bytes = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    const code = ch.charCodeAt(0)
    const mapped = CP1252_HIGH[ch] ?? (code < 0x100 ? code : -1)
    // A character outside cp1252 means this is not mojibake — bail out.
    if (mapped < 0) return value
    bytes[i] = mapped
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Not recoverable as UTF-8 — leave the original rather than corrupt it.
    return value
  }
}

/** Trailing year / season / campaign-period noise on an organization name. */
const TRAILING_NOISE = [
  // "2024", "'21", "Fall '21", "Spring 2023", "Winter 2023", "Fall 2024"
  /\s+(?:spring|summer|fall|autumn|winter)\s*'?\d{2,4}$/i,
  /\s+'\d{2}$/,
  /\s+(?:19|20)\d{2}$/,
  // "Fall", "Spring" left on their own once the year is gone
  /\s+(?:spring|summer|fall|autumn|winter)$/i,
]

/** Names that are filing/tracking artifacts rather than organizations. */
const ARTIFACT_PATTERNS = [
  /^\d+$/, // "16", "25", "9"
  /^\$?\d+(?:\.\d+)?\s*\$?$/, // "$6", "8$"
  /fundraisers?\s+for\s+filing/i,
  /fundraiser\s+totals?$/i,
  /^\d{4}\s+online\s+fr\b/i,
  /^(?:tracking|order\s*form)\b/i,
  /^untitled/i,
]

/**
 * Collapse a raw organization name to its canonical form: mojibake repaired,
 * whitespace normalized, and trailing year/season suffixes stripped so the same
 * group's campaigns across years resolve to one account.
 */
export function canonicalizeOrganizationName(raw: string): string {
  let name = repairMojibake(raw).replace(/\s+/g, ' ').trim()

  // Strip repeatedly: "BGSU Equestrian Team Fall '21" sheds season then year.
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of TRAILING_NOISE) {
      const next = name.replace(pattern, '').trim()
      if (next !== name && next.length > 0) {
        name = next
        changed = true
      }
    }
  }

  return name
}

/**
 * Whether a name looks like a real organization rather than a filing artifact.
 * Deliberately conservative — a real group with an odd name is better kept than
 * silently dropped.
 */
export function isLikelyOrganizationName(raw: string): boolean {
  const name = canonicalizeOrganizationName(raw)
  if (name.length < 3) return false
  if (!/[a-z]/i.test(name)) return false
  return !ARTIFACT_PATTERNS.some((pattern) => pattern.test(name))
}

/** Split "Jane Doe" into first/last; returns nulls when unusable. */
function splitName(value: string | null): {
  firstName: string | null
  lastName: string | null
} {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned.length > 80) return { firstName: null, lastName: null }
  // Reject label leftovers and addresses that landed in the field.
  if (/[@:]/.test(cleaned)) return { firstName: null, lastName: null }

  const parts = cleaned.split(' ')
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  }
}

/** Pick the most informative variant of a name seen across campaigns. */
function bestName(names: string[]): string {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => {
    // Most frequent wins; ties go to the longer, more specific spelling.
    if (b[1] !== a[1]) return b[1] - a[1]
    if (b[0].length !== a[0].length) return b[0].length - a[0].length
    return a[0].localeCompare(b[0])
  })[0][0]
}

/**
 * Merge archived campaign rows into distinct fundraiser accounts.
 *
 * Rows carrying a contact address group by that address, because the same
 * organizer can appear under slightly different group names. Rows without one
 * group by canonical organization name instead, and come back with a null
 * email — they cannot become `Customer` records, which require a unique
 * address, but they are still the real organizations behind the campaigns.
 */
export function buildFundraiserAccounts(
  rows: ArchivedFundraiserRow[]
): FundraiserAccount[] {
  const groups = new Map<string, ArchivedFundraiserRow[]>()

  for (const row of rows) {
    if (!isLikelyOrganizationName(row.organizationName)) continue

    const email = row.contactEmail?.trim().toLowerCase() || null
    const key = email
      ? `email:${email}`
      : `org:${canonicalizeOrganizationName(row.organizationName).toLowerCase()}`

    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  const accounts: FundraiserAccount[] = []

  for (const [key, bucket] of groups) {
    const email = key.startsWith('email:') ? key.slice('email:'.length) : null

    const organizationName = bestName(
      bucket.map((r) => canonicalizeOrganizationName(r.organizationName))
    )

    // Prefer a submitter name that actually parses into a person.
    let firstName: string | null = null
    let lastName: string | null = null
    for (const row of bucket) {
      const split = splitName(row.submittedBy)
      if (split.firstName) {
        firstName = split.firstName
        lastName = split.lastName
        break
      }
    }

    const years = [
      ...new Set(
        bucket
          .map((r) => r.year ?? r.orderDate?.getUTCFullYear() ?? null)
          .filter((y): y is number => typeof y === 'number')
      ),
    ].sort((a, b) => a - b)

    accounts.push({
      organizationName,
      email,
      firstName,
      lastName,
      years,
      campaignCount: bucket.length,
      sourceFiles: bucket.map((r) => r.sourceFile).sort(),
    })
  }

  return accounts.sort((a, b) =>
    a.organizationName.localeCompare(b.organizationName)
  )
}
