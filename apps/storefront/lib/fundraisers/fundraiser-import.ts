import { detectMapping, mappedCell, parseCsv } from '@/lib/csv'
import { parseLooseDate, parseMoney } from '@/lib/events/festivalnet-import'

/**
 * Import of a fundraiser CSV — typically an old spreadsheet of past campaigns.
 *
 * Headers vary between exports, so columns are alias-detected and remain
 * user-overridable. Required: name, organization, contact email, start/end
 * dates, commission rate. A slug is generated from the name when absent; slug is
 * the upsert key so a re-import updates in place.
 */

export type FundraiserField =
  | 'name'
  | 'slug'
  | 'subdomain'
  | 'organizationName'
  | 'contactEmail'
  | 'contactPhone'
  | 'startDate'
  | 'endDate'
  | 'goal'
  | 'commissionRate'
  | 'status'
  | 'description'
  | 'missionStatement'

export type FundraiserMapping = Partial<Record<FundraiserField, string>>

export const FUNDRAISER_REQUIRED_FIELDS: FundraiserField[] = [
  'name',
  'organizationName',
  'contactEmail',
  'startDate',
  'endDate',
  'commissionRate',
]

const FIELD_ALIASES: Record<FundraiserField, string[]> = {
  name: ['name', 'fundraisername', 'campaign', 'campaignname', 'title'],
  slug: ['slug', 'urlslug', 'handle'],
  subdomain: ['subdomain', 'domain'],
  organizationName: [
    'organizationname',
    'organization',
    'organisation',
    'org',
    'school',
    'group',
    'team',
  ],
  contactEmail: ['contactemail', 'email', 'organizeremail', 'coordinatoremail'],
  contactPhone: ['contactphone', 'phone', 'organizerphone', 'telephone'],
  startDate: ['startdate', 'start', 'begindate', 'datestart'],
  endDate: ['enddate', 'end', 'finishdate', 'dateend'],
  goal: ['goal', 'target', 'fundraisinggoal', 'goalamount'],
  commissionRate: ['commissionrate', 'commission', 'rate', 'percentage', 'percent'],
  status: ['status', 'state'],
  description: ['description', 'about', 'details'],
  missionStatement: ['missionstatement', 'mission', 'purpose'],
}

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED'] as const
export type FundraiserStatusValue = (typeof VALID_STATUSES)[number]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Spring 2019 Band Drive" -> "spring-2019-band-drive". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ParsedFundraiser {
  rowNumber: number
  name: string
  slug: string
  subdomain: string | null
  organizationName: string
  contactEmail: string
  contactPhone: string | null
  startDate: Date | null
  endDate: Date | null
  goal: number | null
  commissionRate: number | null
  status: FundraiserStatusValue
  description: string | null
  missionStatement: string | null
  error: string | null
}

function parseStatus(raw: string | null): FundraiserStatusValue {
  if (!raw) return 'DRAFT'
  const upper = raw.trim().toUpperCase()
  return (VALID_STATUSES as readonly string[]).includes(upper)
    ? (upper as FundraiserStatusValue)
    : 'DRAFT'
}

function normalizeRow(
  row: Record<string, string>,
  mapping: FundraiserMapping,
  rowNumber: number
): ParsedFundraiser {
  const name = mappedCell(row, mapping.name)
  const organizationName = mappedCell(row, mapping.organizationName)
  const rawEmail = mappedCell(row, mapping.contactEmail)
  const contactEmail = rawEmail ? rawEmail.toLowerCase() : ''
  const startRaw = mappedCell(row, mapping.startDate)
  const endRaw = mappedCell(row, mapping.endDate)
  const startDate = parseLooseDate(startRaw)
  const endDate = parseLooseDate(endRaw)
  const commissionRate = parseMoney(mappedCell(row, mapping.commissionRate))

  const explicitSlug = mappedCell(row, mapping.slug)
  const slug = explicitSlug ? slugify(explicitSlug) : name ? slugify(name) : ''

  let error: string | null = null
  if (!name) error = 'Missing name'
  else if (!organizationName) error = 'Missing organization'
  else if (!rawEmail) error = 'Missing contact email'
  else if (!EMAIL_RE.test(contactEmail)) error = `Invalid contact email: "${rawEmail}"`
  else if (!startRaw) error = 'Missing start date'
  else if (!startDate) error = `Unrecognized start date: "${startRaw}"`
  else if (!endRaw) error = 'Missing end date'
  else if (!endDate) error = `Unrecognized end date: "${endRaw}"`
  else if (endDate < startDate) error = 'End date is before start date'
  else if (commissionRate === null) error = 'Missing or invalid commission rate'

  return {
    rowNumber,
    name: name ?? '',
    slug,
    subdomain: mappedCell(row, mapping.subdomain),
    organizationName: organizationName ?? '',
    contactEmail,
    contactPhone: mappedCell(row, mapping.contactPhone),
    startDate,
    endDate,
    goal: parseMoney(mappedCell(row, mapping.goal)),
    commissionRate,
    status: parseStatus(mappedCell(row, mapping.status)),
    description: mappedCell(row, mapping.description),
    missionStatement: mappedCell(row, mapping.missionStatement),
    error,
  }
}

export interface ParsedFundraiserCsv {
  headers: string[]
  mapping: FundraiserMapping
  rows: ParsedFundraiser[]
  missingRequired: FundraiserField[]
}

export function parseFundraiserCsv(
  csv: string,
  override?: FundraiserMapping
): ParsedFundraiserCsv {
  const { headers, rows: raw } = parseCsv(csv)
  const mapping = { ...detectMapping(headers, FIELD_ALIASES), ...(override ?? {}) }
  const missingRequired = FUNDRAISER_REQUIRED_FIELDS.filter((f) => !mapping[f])
  const rows = raw.map((row, i) => normalizeRow(row, mapping, i + 1))

  return { headers, mapping, rows, missingRequired }
}
