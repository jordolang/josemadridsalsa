/**
 * Pure helpers for curated product collections.
 *
 * Kept apart from the API route so the two fiddly bits — deriving a URL slug and turning an ordered
 * list of product ids into join rows — are testable without a database.
 */
import { z } from 'zod'

/** A URL-safe slug from a display name. Matches the inline rule the category form has always used. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * A single URL-safe path segment: lowercase letters/digits joined by single hyphens, no leading or
 * trailing hyphen. This is exactly what `slugify` produces, and what `/collections/[slug]` can match
 * as one segment. A hand-edited value like `gift/sets` or one with a `?` would otherwise persist and
 * leave the collection's storefront page unreachable.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Zod schema enforcing {@link SLUG_PATTERN}; shared by the create and update collection routes. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(SLUG_PATTERN, 'Slug must be lowercase letters and numbers separated by single hyphens')

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
