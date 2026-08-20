/**
 * Consolidates every archive source that names a fundraising contact into one
 * deduplicated `FundraiserContact` row per organization or coordinator.
 *
 * Four sources feed this, and they are not the same kind of record:
 *
 *   ARCHIVE_ORDER_FORM   — `ArchivedFundraiser` rows, one per order-form *file*. A group that
 *                          ran five yearly campaigns appears five times, so these are grouped
 *                          by organization and their jar counts summed.
 *   CONSTANT_CONTACT     — the 2016-era coordinator mailing lists. Email + name only, no org
 *                          and no sales, so they stand alone unless the address already
 *                          belongs to an organization recovered from the order forms.
 *   WEBSITE_EXPORT       — the storefront customer export. These are *supporters who bought
 *                          through* a group, not the coordinator who ran it, so they are never
 *                          merged into an organization's record and are imported inactive:
 *                          soliciting them to "run a fundraiser" would be addressed to someone
 *                          who only ever bought a jar of salsa.
 *   MANUAL               — created in the admin UI.
 *
 * Dollar revenue is deliberately absent. The order forms record jar counts only, and the
 * archive spans $6, $8, and $10 per-jar eras, so any dollar figure here would be a guess
 * dressed as a total.
 */

export type ContactSource =
  | 'ARCHIVE_ORDER_FORM'
  | 'ARCHIVE_ORDER_EXPORT'
  | 'CONSTANT_CONTACT'
  | 'WEBSITE_EXPORT'
  | 'MANUAL'

export interface ArchiveRow {
  organizationName: string
  year: number | null
  orderDate: Date | null
  submittedBy: string | null
  contactEmail: string | null
  contactPhone: string | null
  totalJars: number | null
  orderCount: number | null
  formType: 'ORDER_EXPORT' | 'ORDER_FORM' | 'UNKNOWN'
  sourceFile: string
}

export interface ListRow {
  email: string
  firstName?: string | null
  lastName?: string | null
  organizationName?: string | null
  phone?: string | null
  sourceFile: string
  source: ContactSource
  /** Free-text provenance shown in the admin's notes column, e.g. "completed a fundraiser". */
  note?: string | null
}

export interface ConsolidatedContact {
  /// Stable re-import identity. Archive records key on the organization so a coordinator
  /// handover does not fork a new row; list-only records have nothing but the address.
  dedupeKey: string
  organizationName: string
  contactName: string | null
  email: string | null
  phone: string | null
  totalJars: number
  totalOrders: number
  campaignCount: number
  firstCampaignAt: Date | null
  lastCampaignAt: Date | null
  years: number[]
  isActive: boolean
  source: ContactSource
  sourceFiles: string[]
  notes: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/** Jose Madrid's own addresses appear on blank templates; they are never a customer contact. */
const BUSINESS_EMAIL = /@(josemadridsalsa\.com|josemadrid\.net)\b/i

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const email = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return null
  if (BUSINESS_EMAIL.test(email)) return null
  return email
}

/**
 * Digits only, US-normalized. Stored bare rather than formatted because the archive writes
 * these a dozen different ways ("740-521-4304", "9373242633", "(513) 846-5286") and a single
 * canonical form is what makes two spellings of one number dedupe.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  if (digits.length !== 10) return null
  if (/^(\d)\1{9}$/.test(digits)) return null // 0000000000 and friends are placeholders
  return digits
}

/** Display-only. Never feed this back into matching. */
export function formatPhone(digits: string | null | undefined): string | null {
  if (!digits || digits.length !== 10) return digits ?? null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Names that are filing artifacts rather than organizations.
 *
 * The archive's `03 Fundraisers` tree mixes real campaign files with blank templates
 * ("16 Flavors", "order form $6"), per-year rollup workbooks ("2019 Fundraisers for filing",
 * "2025 Fundraiser Totals (2)"), and undated dumping folders. Those all produced an
 * `ArchivedFundraiser` row with an organization name taken from the filename, and every one of
 * them would otherwise become a contact record nobody can email.
 */
export function isNonOrganizationName(raw: string | null | undefined): boolean {
  const name = (raw ?? '').trim()
  if (!name) return true

  // Strip a trailing duplicate-file marker: "Fundraisers 2022 (2)" -> "Fundraisers 2022"
  const lower = name
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
    .toLowerCase()

  // A JMS order-form template names the business, so it survives the token test below.
  if (/^(jose[_ ]?madrid|jms)\b.*order[_ ]?form/i.test(lower)) return true

  // Hyphens and underscores are separators in filenames but joiners in names, so fold them
  // away first: "4-H" reads as one filing token, "Co-op" as one real one.
  const tokens = lower.replace(/[-_]/g, '').split(/[^a-z0-9$.]+/).filter(Boolean)
  if (tokens.length === 0) return true

  // The real test: a name built entirely from filing vocabulary describes a folder, a blank
  // template, or a year rollup — never an organization. "Fundraisers 2022" and "2018
  // Fundraisers for filing" reduce to nothing but filing words; "Anderson HS Band" and
  // "FFA Fruit Sale Participation Donation" both keep tokens that carry real identity.
  return tokens.every((token) => FILING_TOKEN.test(token))
}

/**
 * Vocabulary the archive uses to label folders and templates. Years, bare numbers, and dollar
 * amounts count too: they are how the flavor-count ("16 Flavors") and price-era ("order form
 * $6") templates are named.
 */
const FILING_TOKEN =
  /^(?:fundraiser|fundraisers|fundraising|order|orders|form|forms|total|totals|filing|for|in|of|the|and|online|fr|information|info|website|web|tracking|misc|undated|_undated|hospital|list|lists|email|emails|new|folder|qr|4h|ffa|flavor|flavors|copy|final|sales|\$?\d+(?:\.\d+)?[a-z]?)$/

/**
 * Collapses spelling drift so one organization does not become three rows.
 * Case, punctuation, "(2)" file markers, and a trailing year are all noise here.
 */
export function organizationKey(name: string): string {
  return name
    .replace(/\s*\(\d+\)\s*$/, '')
    .toLowerCase()
    .replace(/['’.,]/g, '')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\bfundraiser(s)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Picks between two spellings of one organization for display.
 *
 * Longer is usually more specific ("Avon HS Crew" over "Avon"), but a filename year is not
 * specificity — "Onsted Sweet Clovers 2024" on a record spanning 2022-2025 reads as a
 * contradiction of the years column next to it. So a year-free name always wins, and length
 * only breaks ties within that.
 */
function displayRank(name: string): number {
  return (/\b(19|20)\d{2}\b/.test(name) ? 0 : 10_000) + name.length
}

/** Tidies an organization name for display without changing which record it belongs to. */
export function cleanOrganizationName(raw: string): string {
  return raw.replace(/\s*\(\d+\)\s*$/, '').replace(/\s+/g, ' ').trim()
}

function personName(first?: string | null, last?: string | null): string | null {
  const name = `${(first ?? '').trim()} ${(last ?? '').trim()}`.trim()
  return name || null
}

function newest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function oldest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

/**
 * Groups per-file archive rows into one record per organization.
 *
 * Contact details come from the most recent campaign that carried them, on the reasoning that
 * a coordinator's 2023 email is likelier to still work than the same group's 2016 one. Jar and
 * order counts sum across every campaign, which is the only sales total the archive supports.
 */
export function consolidateArchiveRows(rows: ArchiveRow[]): ConsolidatedContact[] {
  const byOrg = new Map<string, ConsolidatedContact & { contactSeenAt: Date | null }>()

  for (const row of rows) {
    if (isNonOrganizationName(row.organizationName)) continue

    const key = organizationKey(row.organizationName)
    if (!key) continue

    const email = normalizeEmail(row.contactEmail)
    const phone = normalizePhone(row.contactPhone)
    // Undated forms still carry a year from their folder; fall back to it for ordering.
    const seenAt = row.orderDate ?? (row.year ? new Date(Date.UTC(row.year, 0, 1)) : null)

    const existing = byOrg.get(key)
    if (!existing) {
      byOrg.set(key, {
        dedupeKey: `org:${key}`,
        organizationName: cleanOrganizationName(row.organizationName),
        contactName: row.submittedBy?.trim() || null,
        email,
        phone,
        totalJars: row.totalJars ?? 0,
        totalOrders: row.orderCount ?? 0,
        campaignCount: 1,
        firstCampaignAt: seenAt,
        lastCampaignAt: seenAt,
        years: row.year ? [row.year] : [],
        isActive: true,
        source: row.formType === 'ORDER_EXPORT' ? 'ARCHIVE_ORDER_EXPORT' : 'ARCHIVE_ORDER_FORM',
        sourceFiles: [row.sourceFile],
        notes: null,
        contactSeenAt: email || phone ? seenAt : null,
      })
      continue
    }

    existing.totalJars += row.totalJars ?? 0
    existing.totalOrders += row.orderCount ?? 0
    existing.campaignCount += 1
    existing.firstCampaignAt = oldest(existing.firstCampaignAt, seenAt)
    existing.lastCampaignAt = newest(existing.lastCampaignAt, seenAt)
    if (row.year && !existing.years.includes(row.year)) existing.years.push(row.year)
    if (!existing.sourceFiles.includes(row.sourceFile)) existing.sourceFiles.push(row.sourceFile)

    const cleaned = cleanOrganizationName(row.organizationName)
    if (displayRank(cleaned) > displayRank(existing.organizationName)) {
      existing.organizationName = cleaned
    }

    // Contact details: take them if we have none, or if this campaign is newer than the one
    // they came from. A row with no date never displaces a dated one.
    const better =
      (email || phone) &&
      (!existing.email ||
        (seenAt !== null &&
          (existing.contactSeenAt === null || seenAt > existing.contactSeenAt)))
    if (better) {
      if (email) existing.email = email
      if (phone) existing.phone = phone
      if (row.submittedBy?.trim()) existing.contactName = row.submittedBy.trim()
      existing.contactSeenAt = seenAt
    } else {
      existing.email ??= email
      existing.phone ??= phone
      existing.contactName ??= row.submittedBy?.trim() || null
    }
  }

  return [...byOrg.values()].map(({ contactSeenAt: _drop, ...contact }) => ({
    ...contact,
    years: contact.years.sort((a, b) => a - b),
  }))
}

/**
 * Folds the email-list CSVs onto the organization records.
 *
 * An address already tied to an organization enriches that record — it does not create a
 * second one — so a coordinator on both the 2016 mailing list and a 2022 order form stays one
 * contact. Addresses with no organization behind them become standalone records labelled with
 * the person's name, because `organizationName` is what the admin list renders and an empty
 * one would show as a blank row.
 */
export function mergeListRows(
  base: ConsolidatedContact[],
  listRows: ListRow[],
): ConsolidatedContact[] {
  const out = [...base]
  const byEmail = new Map<string, ConsolidatedContact>()
  for (const contact of out) {
    if (contact.email) byEmail.set(contact.email, contact)
  }

  for (const row of listRows) {
    const email = normalizeEmail(row.email)
    if (!email) continue

    const existing = byEmail.get(email)
    if (existing) {
      if (!existing.sourceFiles.includes(row.sourceFile)) existing.sourceFiles.push(row.sourceFile)
      existing.contactName ??= personName(row.firstName, row.lastName)
      existing.phone ??= normalizePhone(row.phone)
      if (row.note) {
        existing.notes = existing.notes ? `${existing.notes}; ${row.note}` : row.note
      }
      continue
    }

    const orgRaw = (row.organizationName ?? '').trim()
    const org = orgRaw && !isNonOrganizationName(orgRaw) ? cleanOrganizationName(orgRaw) : null
    const person = personName(row.firstName, row.lastName)

    const contact: ConsolidatedContact = {
      dedupeKey: `email:${email}`,
      organizationName: org ?? person ?? email,
      contactName: person,
      email,
      phone: normalizePhone(row.phone),
      totalJars: 0,
      totalOrders: 0,
      campaignCount: 0,
      firstCampaignAt: null,
      lastCampaignAt: null,
      years: [],
      // Supporters who bought through a group are in the database but off by default; they
      // were never the person who ran the campaign.
      isActive: row.source !== 'WEBSITE_EXPORT',
      source: row.source,
      sourceFiles: [row.sourceFile],
      notes: row.note ?? null,
    }
    out.push(contact)
    byEmail.set(email, contact)
  }

  return out
}
