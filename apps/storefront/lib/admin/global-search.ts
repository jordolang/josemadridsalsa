/**
 * Cross-entity admin search.
 *
 * Deliberately federated — each entity is queried directly and the results merged — rather
 * than maintained as a separate search index. An index would have to be kept in sync with
 * every write path in the app, and staleness in a tool staff use to answer "where is this
 * order" is worse than a few extra indexed lookups. At this data scale the queries are
 * cheap; if that stops being true the place to change it is `searchTargets`, not the
 * callers.
 *
 * Query classification exists so that pasting an order number goes straight to that order
 * instead of ranking it among fuzzy name matches.
 */

export type SearchEntity =
  | 'order'
  | 'customer'
  | 'product'
  | 'return'
  | 'fundraiser'
  | 'discount'

export interface SearchResult {
  entity: SearchEntity
  id: string
  title: string
  subtitle?: string | null
  href: string
  /** Higher sorts first. Exact identifier matches outrank fuzzy text. */
  score: number
}

export type QueryShape =
  | 'order-number'
  | 'rma-number'
  | 'email'
  | 'phone'
  | 'tracking'
  | 'sku'
  | 'text'

const ORDER_NUMBER = /^JMS-\d{8}-\d{3,6}$/i
const RMA_NUMBER = /^RMA-\d{8}-\d{3,6}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 10+ digits once separators are stripped; short numbers are ambiguous with quantities. */
const PHONE = /^\+?[\d\s().-]{10,}$/
/** Carrier tracking numbers: long, alphanumeric, no spaces. */
const TRACKING = /^[A-Z0-9]{10,}$/i
const SKU = /^[A-Z]{2,}-[A-Z0-9-]+$/i

/**
 * Work out what the operator most likely pasted.
 *
 * Order matters: an order number also matches the SKU shape, and a tracking number also
 * matches several others, so the most specific patterns are tested first.
 */
export function classifyQuery(raw: string): QueryShape {
  const q = raw.trim()

  if (ORDER_NUMBER.test(q)) return 'order-number'
  if (RMA_NUMBER.test(q)) return 'rma-number'
  if (EMAIL.test(q)) return 'email'
  if (SKU.test(q)) return 'sku'
  if (TRACKING.test(q) && /\d/.test(q)) return 'tracking'
  if (PHONE.test(q) && digitsOnly(q).length >= 10) return 'phone'
  return 'text'
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Base scores by how certain a match is. Exact identifiers beat name fragments. */
export const MATCH_SCORES = {
  exactIdentifier: 100,
  exactEmail: 90,
  trackingNumber: 85,
  sku: 80,
  nameStartsWith: 50,
  nameContains: 30,
} as const

/**
 * Which entities are worth querying for a given query shape.
 *
 * A pasted email should not scan product descriptions, and an order number should not
 * scan customers — narrowing here is what keeps a federated search fast.
 */
export function searchTargets(shape: QueryShape): SearchEntity[] {
  switch (shape) {
    case 'order-number':
      return ['order']
    case 'rma-number':
      return ['return']
    case 'tracking':
      return ['order']
    case 'sku':
      return ['product', 'order']
    case 'email':
      return ['customer', 'order', 'fundraiser']
    case 'phone':
      return ['customer', 'order']
    case 'text':
      return ['order', 'customer', 'product', 'fundraiser', 'discount', 'return']
  }
}

/** Score a text match by how closely it anchors to the start of the field. */
export function scoreTextMatch(field: string, query: string): number {
  const f = field.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return 0
  if (f === q) return MATCH_SCORES.exactIdentifier
  if (f.startsWith(q)) return MATCH_SCORES.nameStartsWith
  if (f.includes(q)) return MATCH_SCORES.nameContains
  return 0
}

/**
 * Order results for display: score first, then entity priority so that a tie between an
 * order and a product puts the order first (staff search for orders far more often), then
 * alphabetically for stability across identical queries.
 */
const ENTITY_PRIORITY: Record<SearchEntity, number> = {
  order: 0,
  return: 1,
  customer: 2,
  product: 3,
  fundraiser: 4,
  discount: 5,
}

export function rankResults(results: SearchResult[], limit = 20): SearchResult[] {
  return [...results]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (ENTITY_PRIORITY[a.entity] !== ENTITY_PRIORITY[b.entity]) {
        return ENTITY_PRIORITY[a.entity] - ENTITY_PRIORITY[b.entity]
      }
      return a.title.localeCompare(b.title)
    })
    .slice(0, limit)
}

/** Group ranked results for a sectioned palette, preserving rank within each group. */
export function groupResults(results: SearchResult[]): [SearchEntity, SearchResult[]][] {
  const groups = new Map<SearchEntity, SearchResult[]>()
  for (const result of results) {
    const bucket = groups.get(result.entity)
    if (bucket) bucket.push(result)
    else groups.set(result.entity, [result])
  }
  return [...groups.entries()].sort(
    ([a], [b]) => ENTITY_PRIORITY[a] - ENTITY_PRIORITY[b]
  )
}

export const ENTITY_LABELS: Record<SearchEntity, string> = {
  order: 'Orders',
  return: 'Returns',
  customer: 'Customers',
  product: 'Products',
  fundraiser: 'Fundraisers',
  discount: 'Discounts',
}

/** Shortest query worth running. Below this every list in the admin would match. */
export const MIN_QUERY_LENGTH = 2

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH
}
