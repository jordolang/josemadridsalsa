/**
 * Planning logic for migrating the committed `public/images` tree to Vercel Blob.
 *
 * Pure, like `sync-plan.ts`, and for the same reason: the risky part of this migration is not the
 * uploading, it is rewriting 179 references without breaking one. Every decision about what a
 * reference becomes is made here, where it can be tested, and applied by the script.
 *
 * Nothing here deletes a local file. The originals stay on disk and in git history — they cost
 * nothing extra (history is already permanent) and they are the fallback if a reference is missed.
 */

import { outputFileName, shouldConvertToWebp } from './sync-plan'

export interface LocalImage {
  /** Path relative to `public/`, e.g. `images/shared/salsa-bowl.png`. */
  relativePath: string
  sizeBytes: number
}

export interface MigrationEntry {
  /** The reference as it appears in code and the database, e.g. `/images/<dir>/salsa-bowl.png`. */
  localRef: string
  /** Where the reference points once migrated — the WebP when converting, e.g. `site/images/shared/salsa-bowl.webp`. */
  blobPathname: string
  /**
   * Where the untouched original lands, e.g. `site/images/shared/salsa-bowl.png`.
   *
   * The original is uploaded alongside any conversion rather than replaced by it, so a consumer
   * that cannot read WebP still has a URL to point at. Equal to `blobPathname` when the file is
   * not converted.
   */
  originalBlobPathname: string
  converted: boolean
  sizeBytes: number
}

/** Which of an entry's two uploads a reference should resolve to. */
export type UrlVariant = 'converted' | 'original'

/** The prefix all migrated site images live under, keeping them clear of `products/` uploads. */
export const SITE_PREFIX = 'site'

/**
 * Turn a file under `public/` into its migration entry.
 *
 * The directory structure is preserved so that a blob URL remains readable and traceable back to
 * the file it replaced — `site/images/shared/salsa-bowl.webp` rather than an opaque hash.
 */
export function planFile(image: LocalImage, convert: boolean): MigrationEntry {
  const segments = image.relativePath.split('/')
  const fileName = segments[segments.length - 1]
  const dir = segments.slice(0, -1).join('/')

  const converting = shouldConvertToWebp(fileName, dir, convert)
  const outName = outputFileName(fileName, converting)
  const outDir = segments.slice(0, -1).join('/')

  const prefix = `${SITE_PREFIX}/${outDir ? `${outDir}/` : ''}`

  return {
    localRef: `/${image.relativePath}`,
    blobPathname: `${prefix}${outName}`,
    originalBlobPathname: `${prefix}${fileName}`,
    converted: converting,
    sizeBytes: image.sizeBytes,
  }
}

/**
 * Build the lookup used to rewrite every reference.
 *
 * Keyed by the local reference exactly as it is written. Both the root-relative form
 * (`/images/x.png`) and the absolute form (`https://www.josemadridsalsa.com/images/x.png`) map to the
 * same blob URL, because the codebase uses both — metadata and email templates need absolute URLs.
 */
export function buildRewriteMap(
  entries: MigrationEntry[],
  storeBaseUrl: string,
  siteOrigins: string[],
  variant: UrlVariant = 'converted'
): Map<string, string> {
  const map = new Map<string, string>()
  const base = storeBaseUrl.replace(/\/+$/, '')

  for (const entry of entries) {
    const pathname = variant === 'original' ? entry.originalBlobPathname : entry.blobPathname
    const blobUrl = `${base}/${pathname}`
    map.set(entry.localRef, blobUrl)
    for (const origin of siteOrigins) {
      map.set(`${origin.replace(/\/+$/, '')}${entry.localRef}`, blobUrl)
    }
  }

  return map
}

export interface RewriteResult {
  text: string
  replacements: Array<{ from: string; to: string; count: number }>
  /**
   * References found inside a template literal (`${SITE_URL}/images/x.png`) and deliberately left
   * alone. Replacing only the path would stitch an absolute blob URL onto the variable and yield
   * `${SITE_URL}https://.../x.png`, so these are reported for a human instead of mangled.
   */
  needsReview: Array<{ ref: string; count: number }>
}

/**
 * A reference only counts when it starts at a delimiter.
 *
 * Without this, a migrated URL is a match for its own key: `site/images/x.png` ends with
 * `/images/x.png`, so a second pass would prefix it again and produce
 * `.../sitehttps://.../site/images/x.png`. Requiring a leading boundary makes the rewrite
 * idempotent, which matters now that the original is uploaded under its own name and every
 * unconverted entry maps onto a URL containing its key verbatim.
 */
const LEADING_BOUNDARY = String.raw`(?<=^|["'\`(=\s,;>\[])`
const TRAILING_BOUNDARY = String.raw`(?=["'\`)\s,;>}]|$)`

/**
 * Replace every known image reference in a blob of text.
 *
 * Longest key first: `https://www.josemadridsalsa.com/images/x.png` contains `/images/x.png`, so
 * rewriting the short form first would corrupt the absolute one into a mangled hybrid.
 *
 * Matching is on exact, whole references only — a path is required to end at a quote, whitespace,
 * a closing paren or the end of the string, so `/images/a.png` never matches inside
 * `/images/a.png.bak`.
 */
export function rewriteText(text: string, map: Map<string, string>): RewriteResult {
  const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length)
  const replacements: RewriteResult['replacements'] = []
  let out = text

  const needsReview: RewriteResult['needsReview'] = []

  for (const key of keys) {
    const to = map.get(key)!
    const escaped = escapeRegExp(key)

    // `${VAR}/images/x.png` — the path is real but the prefix is code, so leave it for a human.
    const templated = out.match(new RegExp(`(?<=\\})${escaped}${TRAILING_BOUNDARY}`, 'g'))
    if (templated?.length) needsReview.push({ ref: key, count: templated.length })

    const pattern = new RegExp(`${LEADING_BOUNDARY}${escaped}${TRAILING_BOUNDARY}`, 'g')
    const matches = out.match(pattern)
    if (!matches?.length) continue

    out = out.replace(pattern, to)
    replacements.push({ from: key, to, count: matches.length })
  }

  return { text: out, replacements, needsReview }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Total bytes the migration removes from the deployment artifact. */
export function summariseMigration(entries: MigrationEntry[]): {
  files: number
  converted: number
  kept: number
  bytes: number
} {
  return {
    files: entries.length,
    converted: entries.filter((e) => e.converted).length,
    kept: entries.filter((e) => !e.converted).length,
    bytes: entries.reduce((n, e) => n + e.sizeBytes, 0),
  }
}
