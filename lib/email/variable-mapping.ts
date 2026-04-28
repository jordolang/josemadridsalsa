/**
 * Template variable mapping.
 *
 * A campaign stores a `variableMappings` map that tells the sender where
 * to pull each {{token}} in the selected template from. This lets users
 * mix-and-match per-subscriber data (firstName, customFields) with
 * campaign-wide static values (coupon codes, discount %) and CSV columns.
 */

export type VariableSource =
  | 'subscriberFirstName'
  | 'subscriberLastName'
  | 'subscriberFullName'
  | 'subscriberEmail'
  | 'subscriberPhone'
  | 'customField'
  | 'static'
  | 'csv'

export interface VariableMapping {
  source: VariableSource
  /** Key used for `customField` (subscriber.customFields key) or `csv` (column name). */
  key?: string
  /** Literal value used when source = `static`. */
  value?: string
  /** Fallback when the resolved source is empty. */
  fallback?: string
}

export type VariableMappings = Record<string, VariableMapping>

export interface SubscriberLike {
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  customFields?: Record<string, unknown> | null
}

export interface VariableSourceOption {
  value: VariableSource
  label: string
  help: string
  needsKey?: boolean
  needsValue?: boolean
}

export const VARIABLE_SOURCE_OPTIONS: readonly VariableSourceOption[] = [
  {
    value: 'subscriberFirstName',
    label: 'Subscriber First Name',
    help: "From each subscriber's firstName",
  },
  {
    value: 'subscriberLastName',
    label: 'Subscriber Last Name',
    help: "From each subscriber's lastName",
  },
  {
    value: 'subscriberFullName',
    label: 'Subscriber Full Name',
    help: 'First + last name joined',
  },
  {
    value: 'subscriberEmail',
    label: 'Subscriber Email',
    help: 'Recipient email address',
  },
  {
    value: 'subscriberPhone',
    label: 'Subscriber Phone',
    help: 'Phone on record (if set)',
  },
  {
    value: 'customField',
    label: 'Custom Subscriber Field',
    help: 'Pulled from subscriber customFields by key',
    needsKey: true,
  },
  {
    value: 'static',
    label: 'Fixed Value (same for all)',
    help: 'E.g. "SAVE10" or "20%"',
    needsValue: true,
  },
  {
    value: 'csv',
    label: 'CSV Column',
    help: 'Maps to a column in the uploaded CSV',
    needsKey: true,
  },
] as const

const TOKEN_REGEX = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g

/**
 * Tokens that live in the shared email footer (or are otherwise injected by
 * the sender) and should NOT show up as mappable rows in the campaign field
 * mapping UI. Senders only need to map tokens they themselves placed in the
 * visible body of the template.
 */
const RESERVED_TOKENS = new Set([
  'UNSUBSCRIBE_URL',
  'RESEND_UNSUBSCRIBE_URL',
  'NEWSLETTER_PREFERENCES_URL',
  'VIEW_IN_BROWSER_URL',
  'FORWARD_TO_FRIEND_URL',
])

/**
 * Scan template strings for unique `{{variable}}` tokens.
 * Reserved tokens (e.g. UNSUBSCRIBE_URL) are filtered out.
 */
export function extractVariables(
  ...parts: ReadonlyArray<string | null | undefined>
): string[] {
  const found = new Set<string>()
  for (const part of parts) {
    if (!part) continue
    for (const match of part.matchAll(TOKEN_REGEX)) {
      const name = match[1]
      if (!RESERVED_TOKENS.has(name)) found.add(name)
    }
  }
  return Array.from(found).sort((a, b) => a.localeCompare(b))
}

/** Pick a sensible default mapping by looking at the variable name. */
export function defaultMappingFor(variable: string): VariableMapping {
  const lower = variable.toLowerCase().replace(/[_\s-]/g, '')
  if (lower === 'firstname') return { source: 'subscriberFirstName' }
  if (lower === 'lastname') return { source: 'subscriberLastName' }
  if (lower === 'name' || lower === 'fullname')
    return { source: 'subscriberFullName' }
  if (lower === 'email' || lower === 'emailaddress')
    return { source: 'subscriberEmail' }
  if (lower === 'phone' || lower === 'phonenumber')
    return { source: 'subscriberPhone' }
  return { source: 'customField', key: variable }
}

/** Build default mappings for every variable in the list. */
export function defaultMappingsForVariables(
  variables: ReadonlyArray<string>,
): VariableMappings {
  const out: VariableMappings = {}
  for (const v of variables) out[v] = defaultMappingFor(v)
  return out
}

/** Resolve a single mapping against subscriber data (and optional CSV row). */
export function resolveMapping(
  mapping: VariableMapping,
  subscriber: SubscriberLike,
  csvRow?: Record<string, string>,
): string {
  const fallback = mapping.fallback ?? ''
  const nonEmpty = (v: unknown): v is string =>
    typeof v === 'string' && v.length > 0

  switch (mapping.source) {
    case 'subscriberFirstName':
      return nonEmpty(subscriber.firstName) ? subscriber.firstName : fallback
    case 'subscriberLastName':
      return nonEmpty(subscriber.lastName) ? subscriber.lastName : fallback
    case 'subscriberFullName': {
      const full = [subscriber.firstName, subscriber.lastName]
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .join(' ')
        .trim()
      return full || fallback
    }
    case 'subscriberEmail':
      return subscriber.email || fallback
    case 'subscriberPhone':
      return nonEmpty(subscriber.phone) ? subscriber.phone : fallback
    case 'customField': {
      if (!mapping.key) return fallback
      const raw = subscriber.customFields?.[mapping.key]
      if (raw === undefined || raw === null || raw === '') return fallback
      return String(raw)
    }
    case 'static':
      return mapping.value ?? fallback
    case 'csv': {
      if (!mapping.key || !csvRow) return fallback
      const raw = csvRow[mapping.key]
      if (raw === undefined || raw === '') return fallback
      return raw
    }
    default:
      return fallback
  }
}

/** Resolve every mapping for one recipient into a flat variables object. */
export function resolveVariablesForRecipient(
  mappings: VariableMappings,
  subscriber: SubscriberLike,
  csvRow?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, mapping] of Object.entries(mappings)) {
    out[key] = resolveMapping(mapping, subscriber, csvRow)
  }
  return out
}

/** Narrow unknown JSON (e.g. from Prisma) into a VariableMappings shape. */
export function parseVariableMappings(input: unknown): VariableMappings {
  if (!input || typeof input !== 'object') return {}
  const out: VariableMappings = {}
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const m = raw as Record<string, unknown>
    if (typeof m.source !== 'string') continue
    out[key] = {
      source: m.source as VariableSource,
      key: typeof m.key === 'string' ? m.key : undefined,
      value: typeof m.value === 'string' ? m.value : undefined,
      fallback: typeof m.fallback === 'string' ? m.fallback : undefined,
    }
  }
  return out
}
