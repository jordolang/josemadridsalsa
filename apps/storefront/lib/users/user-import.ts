import { detectMapping, mappedCell, parseCsv } from '@/lib/csv'

/**
 * Import of a user-account CSV (round-trips the editable columns of the users
 * export).
 *
 * Security: a spreadsheet must not be able to mint or elevate privileged
 * accounts. Only CUSTOMER / WHOLESALE / FUNDRAISER roles may be assigned on
 * create; a row asking for ADMIN/STAFF/DEVELOPER is rejected. Roles of existing
 * accounts are never changed by an import (the route ignores role on update),
 * so a stray row can't demote an admin either.
 */

export type UserField = 'email' | 'name' | 'phone' | 'role'

export type UserMapping = Partial<Record<UserField, string>>

export const USER_REQUIRED_FIELDS: UserField[] = ['email']

/** Roles a CSV import is allowed to assign to new accounts. */
export const IMPORTABLE_ROLES = ['CUSTOMER', 'WHOLESALE', 'FUNDRAISER'] as const
export type ImportableRole = (typeof IMPORTABLE_ROLES)[number]

const PRIVILEGED_ROLES = ['ADMIN', 'STAFF', 'DEVELOPER']

const FIELD_ALIASES: Record<UserField, string[]> = {
  email: ['emailaddress', 'email'],
  name: ['name', 'fullname', 'customername', 'contactname'],
  phone: ['phonenumber', 'phone', 'mobile', 'cell', 'telephone'],
  role: ['role', 'accounttype', 'usertype'],
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ParsedUser {
  rowNumber: number
  email: string
  name: string | null
  phone: string | null
  role: ImportableRole
  error: string | null
}

function normalizeRow(
  row: Record<string, string>,
  mapping: UserMapping,
  rowNumber: number
): ParsedUser {
  const rawEmail = mappedCell(row, mapping.email)
  const email = rawEmail ? rawEmail.toLowerCase() : ''
  const rawRole = mappedCell(row, mapping.role)
  const upperRole = rawRole ? rawRole.trim().toUpperCase() : ''

  let error: string | null = null
  let role: ImportableRole = 'CUSTOMER'

  if (!rawEmail) {
    error = 'Missing email'
  } else if (!EMAIL_RE.test(email)) {
    error = `Invalid email: "${rawEmail}"`
  } else if (upperRole) {
    if ((IMPORTABLE_ROLES as readonly string[]).includes(upperRole)) {
      role = upperRole as ImportableRole
    } else if (PRIVILEGED_ROLES.includes(upperRole)) {
      error = `Role "${upperRole}" can't be assigned by import — set it in the admin UI`
    } else {
      error = `Unknown role: "${rawRole}"`
    }
  }

  return {
    rowNumber,
    email,
    name: mappedCell(row, mapping.name),
    phone: mappedCell(row, mapping.phone),
    role,
    error,
  }
}

export interface ParsedUserCsv {
  headers: string[]
  mapping: UserMapping
  rows: ParsedUser[]
  missingRequired: UserField[]
}

export function parseUserCsv(csv: string, override?: UserMapping): ParsedUserCsv {
  const { headers, rows: raw } = parseCsv(csv)
  const mapping = { ...detectMapping(headers, FIELD_ALIASES), ...(override ?? {}) }
  const missingRequired = USER_REQUIRED_FIELDS.filter((f) => !mapping[f])
  const rows = raw.map((row, i) => normalizeRow(row, mapping, i + 1))

  return { headers, mapping, rows, missingRequired }
}
