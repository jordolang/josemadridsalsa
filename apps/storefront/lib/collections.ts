/**
 * Pure helpers for curated product collections.
 *
 * Kept apart from the API route so the two fiddly bits — deriving a URL slug and turning an ordered
 * list of product ids into join rows — are testable without a database.
 */

/** A URL-safe slug from a display name. Matches the inline rule the category form has always used. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Turn an ordered list of product ids into `CollectionProduct` create rows, carrying each product's
 * position as `sortOrder` so the collection keeps the order it was arranged in. Duplicate ids are
 * dropped, keeping the first occurrence — the join is unique per (collection, product), and a
 * repeated id would otherwise collide on insert. Blank ids are ignored.
 */
export function collectionProductRows(
  productIds: string[]
): Array<{ productId: string; sortOrder: number }> {
  const seen = new Set<string>()
  const rows: Array<{ productId: string; sortOrder: number }> = []

  for (const raw of productIds) {
    const productId = raw.trim()
    if (!productId || seen.has(productId)) continue
    seen.add(productId)
    rows.push({ productId, sortOrder: rows.length })
  }

  return rows
}
