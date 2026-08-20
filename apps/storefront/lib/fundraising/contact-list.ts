import type { Prisma } from '@prisma/client'

/**
 * Shared query shaping for the admin fundraiser-contact list.
 *
 * The list page and the solicitation dialog both have to agree on what "the current view"
 * means: the dialog offers to mail "all N matching", and if it resolved the filters
 * differently from the table it would mail a different set of people than the one on screen.
 * Everything here is pure so both can reuse it and it can be unit-tested.
 */

export const CONTACT_SORT_COLUMNS = [
  'organization',
  'contact',
  'email',
  'jars',
  'campaigns',
  'lastCampaign',
  'lastSolicited',
  'status',
] as const

export type ContactSortColumn = (typeof CONTACT_SORT_COLUMNS)[number]
export type SortDirection = 'asc' | 'desc'

export const DEFAULT_SORT: ContactSortColumn = 'jars'
export const DEFAULT_SORT_DIR: SortDirection = 'desc'

export const CONTACT_PAGE_SIZES = [50, 100, 250, 500] as const
export const DEFAULT_PAGE_SIZE = 100

export function resolveSortColumn(value: unknown): ContactSortColumn {
  return typeof value === 'string' &&
    (CONTACT_SORT_COLUMNS as readonly string[]).includes(value)
    ? (value as ContactSortColumn)
    : DEFAULT_SORT
}

export function resolveSortDirection(value: unknown): SortDirection {
  return value === 'asc' || value === 'desc' ? value : DEFAULT_SORT_DIR
}

export function resolvePageSize(value: unknown): number {
  const n = Number(value)
  return (CONTACT_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE
}

export function resolvePage(value: unknown): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 1
}

export interface ContactFilters {
  search?: string
  status?: string
  source?: string
  /** 'active' | 'inactive'; anything else means both. */
  active?: string
  /** 'yes' | 'no'; anything else means both. */
  hasEmail?: string
  /** Only organizations with recovered campaign history. */
  withHistory?: string
  year?: string
}

const STATUSES = ['NEW', 'CONTACTED', 'RESPONDED', 'CONVERTED', 'DO_NOT_CONTACT']
const SOURCES = [
  'ARCHIVE_ORDER_FORM',
  'ARCHIVE_ORDER_EXPORT',
  'CONSTANT_CONTACT',
  'WEBSITE_EXPORT',
  'MANUAL',
]

/**
 * Prisma `where` for the current view.
 *
 * `hasEmail=no` deliberately matches both a null address and an empty string: the archive
 * produced a few blank cells that survived as `''`, and a row that renders "no email" in the
 * table must also be excluded when the send path asks for mailable rows.
 */
export function buildContactWhere(filters: ContactFilters): Prisma.FundraiserContactWhereInput {
  const where: Prisma.FundraiserContactWhereInput = {}
  const and: Prisma.FundraiserContactWhereInput[] = []

  const search = filters.search?.trim()
  if (search) {
    and.push({
      OR: [
        { organizationName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search.replace(/\D/g, '') || search } },
      ],
    })
  }

  if (filters.status && STATUSES.includes(filters.status)) {
    where.status = filters.status as Prisma.FundraiserContactWhereInput['status']
  }
  if (filters.source && SOURCES.includes(filters.source)) {
    where.source = filters.source as Prisma.FundraiserContactWhereInput['source']
  }
  if (filters.active === 'active') where.isActive = true
  if (filters.active === 'inactive') where.isActive = false

  if (filters.hasEmail === 'yes') and.push({ NOT: [{ email: null }, { email: '' }] })
  if (filters.hasEmail === 'no') and.push({ OR: [{ email: null }, { email: '' }] })

  if (filters.withHistory === 'yes') where.campaignCount = { gt: 0 }

  const year = Number.parseInt(filters.year ?? '', 10)
  if (Number.isFinite(year)) where.years = { has: year }

  if (and.length) where.AND = and
  return where
}

/**
 * Rows that a bulk solicitation is allowed to touch: active, not opted out, and with an
 * address to send to. Suppression and unsubscribe are checked per-address at send time, since
 * those live in their own tables and change independently of this list.
 */
export function buildMailableWhere(
  filters: ContactFilters,
): Prisma.FundraiserContactWhereInput {
  return {
    AND: [
      buildContactWhere(filters),
      { isActive: true },
      { status: { not: 'DO_NOT_CONTACT' } },
      { NOT: [{ email: null }, { email: '' }] },
    ],
  }
}

/**
 * Prisma `orderBy` for a whitelisted column.
 *
 * Nullable columns push blanks to the end in both directions — most contacts recovered from
 * the mailing lists have no campaign history, and they should not monopolise the first page
 * just because you sorted by last campaign. Every sort falls back to `organizationName` so
 * paging through two thousand rows stays stable instead of reshuffling ties between pages.
 */
export function buildContactOrderBy(
  column: ContactSortColumn,
  direction: SortDirection,
): Prisma.FundraiserContactOrderByWithRelationInput[] {
  const nullsLast = { sort: direction, nulls: 'last' } as const
  const tieBreak: Prisma.FundraiserContactOrderByWithRelationInput = {
    organizationName: 'asc',
  }

  switch (column) {
    case 'organization':
      return [{ organizationName: direction }, { id: 'asc' }]
    case 'contact':
      return [{ contactName: nullsLast }, tieBreak]
    case 'email':
      return [{ email: nullsLast }, tieBreak]
    case 'campaigns':
      return [{ campaignCount: direction }, tieBreak]
    case 'lastCampaign':
      return [{ lastCampaignAt: nullsLast }, tieBreak]
    case 'lastSolicited':
      return [{ lastSolicitedAt: nullsLast }, tieBreak]
    case 'status':
      return [{ status: direction }, tieBreak]
    case 'jars':
    default:
      return [{ totalJars: direction }, tieBreak]
  }
}
