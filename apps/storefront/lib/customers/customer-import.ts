import { detectMapping, mappedCell, parseCsv } from '@/lib/csv'

/**
 * Import of a customer/contact CSV.
 *
 * Built around the Constant Contact export format we already have on file
 * (`Email address, First name, Last name, Email status, Email permission
 * status, Source Name, Created At`), but header detection is alias-based and
 * user-overridable so a plain "email, name" spreadsheet works too. Email is the
 * only required column and is the natural key for upserts.
 */

export type CustomerField =
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'emailStatus'
  | 'emailPermissionStatus'
  | 'sourceName'
  | 'notes'

export type CustomerMapping = Partial<Record<CustomerField, string>>

export const CUSTOMER_REQUIRED_FIELDS: CustomerField[] = ['email']

const FIELD_ALIASES: Record<CustomerField, string[]> = {
  email: ['emailaddress', 'email', 'emailaddr'],
  firstName: ['firstname', 'first', 'fname', 'givenname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname'],
  phone: ['phonenumber', 'phone', 'mobile', 'cell', 'telephone', 'tel'],
  emailStatus: ['emailstatus', 'status'],
  emailPermissionStatus: [
    'emailpermissionstatus',
    'permissionstatus',
    'permission',
    'optin',
    'consent',
  ],
  sourceName: ['sourcename', 'source', 'listname', 'origin'],
  notes: ['notes', 'comments', 'note'],
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ParsedCustomer {
  /** 1-based row number in the source file, for error messages. */
  rowNumber: number
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  emailStatus: string | null
  emailPermissionStatus: string | null
  sourceName: string | null
  notes: string | null
  /** Populated when the row can't be imported. */
  error: string | null
}

function normalizeRow(
  row: Record<string, string>,
  mapping: CustomerMapping,
  rowNumber: number
): ParsedCustomer {
  const rawEmail = mappedCell(row, mapping.email)
  const email = rawEmail ? rawEmail.toLowerCase() : ''

  let error: string | null = null
  if (!rawEmail) {
    error = 'Missing email'
  } else if (!EMAIL_RE.test(email)) {
    error = `Invalid email: "${rawEmail}"`
  }

  return {
    rowNumber,
    email,
    firstName: mappedCell(row, mapping.firstName),
    lastName: mappedCell(row, mapping.lastName),
    phone: mappedCell(row, mapping.phone),
    emailStatus: mappedCell(row, mapping.emailStatus),
    emailPermissionStatus: mappedCell(row, mapping.emailPermissionStatus),
    sourceName: mappedCell(row, mapping.sourceName),
    notes: mappedCell(row, mapping.notes),
    error,
  }
}

export interface ParsedCustomerCsv {
  headers: string[]
  mapping: CustomerMapping
  rows: ParsedCustomer[]
  /** Required fields with no column assigned — the import can't run yet. */
  missingRequired: CustomerField[]
}

export function parseCustomerCsv(
  csv: string,
  override?: CustomerMapping
): ParsedCustomerCsv {
  const { headers, rows: raw } = parseCsv(csv)
  const mapping = { ...detectMapping(headers, FIELD_ALIASES), ...(override ?? {}) }
  const missingRequired = CUSTOMER_REQUIRED_FIELDS.filter((f) => !mapping[f])
  const rows = raw.map((row, i) => normalizeRow(row, mapping, i + 1))

  return { headers, mapping, rows, missingRequired }
}

/** Full name for display, or null when neither name part is present. */
export function customerDisplayName(c: {
  firstName: string | null
  lastName: string | null
}): string | null {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return name.length > 0 ? name : null
}
