import { detectMapping, mappedCell, parseCsv } from '@/lib/csv'

/**
 * Import of a fundraiser-participant CSV — the sellers/students within a
 * fundraiser. Each row must name the fundraiser it belongs to (by slug or name),
 * which the API route resolves to an id. Pure parsing/validation lives here; the
 * route handles fundraiser lookup, matching, and referral-code generation.
 */

export type ParticipantField =
  | 'fundraiser'
  | 'name'
  | 'email'
  | 'phone'
  | 'referralCode'
  | 'status'

export type ParticipantMapping = Partial<Record<ParticipantField, string>>

export const PARTICIPANT_REQUIRED_FIELDS: ParticipantField[] = [
  'fundraiser',
  'name',
  'email',
]

const FIELD_ALIASES: Record<ParticipantField, string[]> = {
  fundraiser: [
    'fundraiser',
    'fundraisername',
    'fundraiserslug',
    'campaign',
    'campaignname',
  ],
  name: ['name', 'participantname', 'seller', 'student', 'fullname'],
  email: ['emailaddress', 'email'],
  phone: ['phonenumber', 'phone', 'mobile', 'cell', 'telephone'],
  referralCode: ['referralcode', 'referral', 'code'],
  status: ['status', 'state'],
}

const VALID_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type ParticipantStatusValue = (typeof VALID_STATUSES)[number]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ParsedParticipant {
  rowNumber: number
  /** Raw fundraiser reference (slug or name) — resolved to an id by the route. */
  fundraiserRef: string
  name: string
  email: string
  phone: string | null
  referralCode: string | null
  status: ParticipantStatusValue
  error: string | null
}

function parseStatus(raw: string | null): ParticipantStatusValue {
  if (!raw) return 'ACTIVE'
  const upper = raw.trim().toUpperCase()
  return (VALID_STATUSES as readonly string[]).includes(upper)
    ? (upper as ParticipantStatusValue)
    : 'ACTIVE'
}

function normalizeRow(
  row: Record<string, string>,
  mapping: ParticipantMapping,
  rowNumber: number
): ParsedParticipant {
  const fundraiserRef = mappedCell(row, mapping.fundraiser)
  const name = mappedCell(row, mapping.name)
  const rawEmail = mappedCell(row, mapping.email)
  const email = rawEmail ? rawEmail.toLowerCase() : ''

  let error: string | null = null
  if (!fundraiserRef) error = 'Missing fundraiser'
  else if (!name) error = 'Missing name'
  else if (!rawEmail) error = 'Missing email'
  else if (!EMAIL_RE.test(email)) error = `Invalid email: "${rawEmail}"`

  const referralCode = mappedCell(row, mapping.referralCode)

  return {
    rowNumber,
    fundraiserRef: fundraiserRef ?? '',
    name: name ?? '',
    email,
    phone: mappedCell(row, mapping.phone),
    referralCode: referralCode ? referralCode.trim().toUpperCase() : null,
    status: parseStatus(mappedCell(row, mapping.status)),
    error,
  }
}

export interface ParsedParticipantCsv {
  headers: string[]
  mapping: ParticipantMapping
  rows: ParsedParticipant[]
  missingRequired: ParticipantField[]
}

export function parseParticipantCsv(
  csv: string,
  override?: ParticipantMapping
): ParsedParticipantCsv {
  const { headers, rows: raw } = parseCsv(csv)
  const mapping = { ...detectMapping(headers, FIELD_ALIASES), ...(override ?? {}) }
  const missingRequired = PARTICIPANT_REQUIRED_FIELDS.filter((f) => !mapping[f])
  const rows = raw.map((row, i) => normalizeRow(row, mapping, i + 1))

  return { headers, mapping, rows, missingRequired }
}
