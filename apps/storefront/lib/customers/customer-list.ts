import type { Prisma } from '@prisma/client'

/**
 * Shared query shaping for the admin customer list.
 *
 * The list page, the CSV export, and the mailing-list builder all have to agree
 * on what "the current view" means — otherwise exporting or building a list
 * from a filtered screen silently operates on a different set of people than
 * the one on screen. Everything here is pure so it can be unit-tested and
 * reused from all three.
 */

export const CUSTOMER_SORT_COLUMNS = [
  'customer',
  'email',
  'phone',
  'accountType',
  'source',
  'sourceName',
  'emailStatus',
  'orders',
  'spent',
  'lastOrder',
  'created',
] as const

export type CustomerSortColumn = (typeof CUSTOMER_SORT_COLUMNS)[number]
export type SortDirection = 'asc' | 'desc'

export const DEFAULT_SORT: CustomerSortColumn = 'created'
export const DEFAULT_SORT_DIR: SortDirection = 'desc'

/** Page sizes offered in the UI. The list is long, so it starts wide. */
export const CUSTOMER_PAGE_SIZES = [100, 250, 500, 1000] as const
export const DEFAULT_PAGE_SIZE = 500

export function isSortColumn(value: unknown): value is CustomerSortColumn {
  return (
    typeof value === 'string' &&
    (CUSTOMER_SORT_COLUMNS as readonly string[]).includes(value)
  )
}

export function resolveSortColumn(value: unknown): CustomerSortColumn {
  return isSortColumn(value) ? value : DEFAULT_SORT
}

export function resolveSortDirection(value: unknown): SortDirection {
  return value === 'asc' || value === 'desc' ? value : DEFAULT_SORT_DIR
}

export function resolvePageSize(value: unknown): number {
  const n = Number(value)
  return (CUSTOMER_PAGE_SIZES as readonly number[]).includes(n)
    ? n
    : DEFAULT_PAGE_SIZE
}

export function resolvePage(value: unknown): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 1
}

/**
 * Prisma `orderBy` for a whitelisted column.
 *
 * Two rules throughout: nullable columns push their blanks to the end in both
 * directions (5,000+ customers have no name, and they shouldn't monopolise the
 * first page just because you sorted by name), and every sort falls back to
 * `email` so paging through 22k rows stays stable instead of reshuffling ties
 * between pages.
 */
export function buildCustomerOrderBy(
  column: CustomerSortColumn,
  direction: SortDirection
): Prisma.CustomerOrderByWithRelationInput[] {
  const nullsLast = { sort: direction, nulls: 'last' } as const
  const tieBreak: Prisma.CustomerOrderByWithRelationInput = { email: 'asc' }

  switch (column) {
    case 'customer':
      return [{ lastName: nullsLast }, { firstName: nullsLast }, tieBreak]
    case 'email':
      return [{ email: direction }]
    case 'phone':
      return [{ phone: nullsLast }, tieBreak]
    case 'accountType':
      // Enum columns sort by declaration order (STANDARD, FUNDRAISING,
      // WHOLESALE), not alphabetically by label.
      return [{ accountType: direction }, tieBreak]
    case 'source':
      return [{ source: direction }, tieBreak]
    case 'sourceName':
      return [{ sourceName: nullsLast }, tieBreak]
    case 'emailStatus':
      return [{ emailStatus: nullsLast }, tieBreak]
    case 'orders':
      return [{ totalOrders: direction }, tieBreak]
    case 'spent':
      return [{ totalSpent: direction }, tieBreak]
    case 'lastOrder':
      return [{ lastOrderAt: nullsLast }, tieBreak]
    case 'created':
      return [{ createdAt: direction }, tieBreak]
  }
}

export interface CustomerListFilters {
  search?: string | null
  source?: string | null
  accountType?: string | null
}

const SOURCES = ['IMPORT', 'GUEST_ORDER', 'REGISTERED', 'MANUAL']
const ACCOUNT_TYPES = ['STANDARD', 'FUNDRAISING', 'WHOLESALE']

/**
 * `where` clause for the list. Unrecognized filter values are ignored rather
 * than passed to Prisma, so a hand-edited query string can't error the page or
 * reach the database as an invalid enum.
 */
export function buildCustomerWhere(
  filters: CustomerListFilters
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {}

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { sourceName: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (filters.source && SOURCES.includes(filters.source)) {
    where.source = filters.source as Prisma.CustomerWhereInput['source']
  }

  if (filters.accountType && ACCOUNT_TYPES.includes(filters.accountType)) {
    where.accountType =
      filters.accountType as Prisma.CustomerWhereInput['accountType']
  }

  return where
}

/**
 * Maps an imported `Customer.emailStatus` onto a `SubscriberStatus`.
 *
 * Deliberately fails closed: anything that isn't recognisably mailable becomes
 * UNSUBSCRIBED. Roughly 7,000 archive contacts opted out through Constant
 * Contact, and a mailing list built from them must carry that forward rather
 * than defaulting them back to subscribed.
 */
export type SubscriberStatusValue =
  | 'SUBSCRIBED'
  | 'UNSUBSCRIBED'
  | 'BOUNCED'
  | 'COMPLAINED'

export function subscriberStatusFor(
  emailStatus: string | null | undefined
): SubscriberStatusValue {
  const v = emailStatus?.trim().toLowerCase()
  if (!v) return 'SUBSCRIBED'
  if (v.startsWith('bounce')) return 'BOUNCED'
  if (v.startsWith('complain') || v.startsWith('spam')) return 'COMPLAINED'
  if (v === 'active' || v === 'implied' || v === 'express' || v === 'subscribed') {
    return 'SUBSCRIBED'
  }
  // Unsubscribed, Removed, Suppressed, Pending, and anything unrecognised.
  return 'UNSUBSCRIBED'
}
