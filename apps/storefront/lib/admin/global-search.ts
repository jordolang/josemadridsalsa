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
 * instead of ranking it among fuzzy name matches. Free text, by contrast, deliberately
 * fans out across everything the operator can see — live commerce records, the document
 * archive, and website content — because "search a name and find every trace of it" is the
 * whole point of the box.
 */

export type SearchEntity =
  // Live commerce and operations
  | 'order'
  | 'return'
  | 'customer'
  | 'product'
  | 'fundraiser'
  | 'participant'
  | 'contact'
  | 'user'
  | 'supplier'
  | 'location'
  | 'event'
  | 'discount'
  // Documents and files
  | 'document'
  | 'training'
  | 'media'
  | 'invoice'
  | 'purchase-order'
  | 'gift-certificate'
  // Website content
  | 'blog'
  | 'page'
  | 'recipe'
  | 'campaign'
  // Historical archive and financial data
  | 'archived-fundraiser'
  | 'show-sale'
  | 'mileage'
  | 'ledger'

export interface SearchResult {
  entity: SearchEntity
  id: string
  title: string
  subtitle?: string | null
  href: string
  /** Higher sorts first. Exact identifier matches outrank fuzzy text. */
  score: number
  /**
   * Where inside the record the query was found, when it was not the title — a line of the
   * extracted document text, a note, a description. Shown so an operator can tell why a
   * document with an unrelated filename came back.
   */
  excerpt?: string | null
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
  /**
   * The query was found in a body of text — extracted document text, a note, a description —
   * rather than in anything that names the record. Below `nameContains` so a document
   * actually called "Zanesville High" outranks one that merely mentions it.
   */
  bodyContains: 15,
} as const

/** Every entity the free-text fan-out covers, in the order results are grouped. */
const ALL_ENTITIES: SearchEntity[] = [
  'order',
  'return',
  'customer',
  'product',
  'fundraiser',
  'participant',
  'contact',
  'user',
  'supplier',
  'location',
  'event',
  'discount',
  'document',
  'training',
  'media',
  'invoice',
  'purchase-order',
  'gift-certificate',
  'blog',
  'page',
  'recipe',
  'campaign',
  'archived-fundraiser',
  'show-sale',
  'mileage',
  'ledger',
]

/**
 * Which entities are worth querying for a given query shape.
 *
 * A pasted email should not scan product descriptions, and an order number should not
 * scan customers — narrowing here is what keeps a federated search fast. Free text is the
 * exception: it scans everything, because a fundraiser name can appear in a campaign
 * record, an archived order form, and the text of a scanned document all at once.
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
      return [
        'customer',
        'order',
        'fundraiser',
        'participant',
        'contact',
        'user',
        'supplier',
        'gift-certificate',
        'archived-fundraiser',
      ]
    case 'phone':
      return [
        'customer',
        'order',
        'fundraiser',
        'participant',
        'contact',
        'user',
        'supplier',
        'location',
        'archived-fundraiser',
      ]
    case 'text':
      return [...ALL_ENTITIES]
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
 * Pull the sentence around the first occurrence of the query out of a long body of text.
 *
 * Document rows carry the entire extracted text, so returning the field itself would ship
 * megabytes to the palette. Returns null when the query is not in the text at all, which
 * is how a caller tells a title match from a body match.
 */
export function extractExcerpt(text: string | null | undefined, query: string, radius = 60): string | null {
  if (!text) return null
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (at === -1) return null

  const start = Math.max(0, at - radius)
  const end = Math.min(text.length, at + query.trim().length + radius)
  const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim()

  return `${start > 0 ? '…' : ''}${snippet}${end < text.length ? '…' : ''}`
}

/**
 * Order results for display: score first, then entity priority so that a tie between an
 * order and a product puts the order first (staff search for orders far more often), then
 * alphabetically for stability across identical queries.
 */
const ENTITY_PRIORITY: Record<SearchEntity, number> = Object.fromEntries(
  ALL_ENTITIES.map((entity, index) => [entity, index])
) as Record<SearchEntity, number>

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
  participant: 'Participants',
  contact: 'Fundraiser contacts',
  user: 'Users',
  supplier: 'Suppliers',
  location: 'Retail locations',
  event: 'Events',
  discount: 'Discounts',
  document: 'Archive documents',
  training: 'Training documents',
  media: 'Media',
  invoice: 'Invoices',
  'purchase-order': 'Purchase orders',
  'gift-certificate': 'Gift certificates',
  blog: 'Blog posts',
  page: 'Pages',
  recipe: 'Recipes',
  campaign: 'Email campaigns',
  'archived-fundraiser': 'Archived fundraisers',
  'show-sale': 'Show sales',
  mileage: 'Mileage',
  ledger: 'Ledger entries',
}

/** Shortest query worth running. Below this every list in the admin would match. */
export const MIN_QUERY_LENGTH = 2

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH
}
