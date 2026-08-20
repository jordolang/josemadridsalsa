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
  /** The reference as it appears in code and the database, e.g. `https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/salsa-bowl.webp`. */
  localRef: string
  /** Where it lands in the blob store, e.g. `site/images/shared/salsa-bowl.webp`. */
  blobPathname: string
  converted: boolean
  sizeBytes: number
}

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

  return {
    localRef: `/${image.relativePath}`,
    blobPathname: `${SITE_PREFIX}/${outDir ? `${outDir}/` : ''}${outName}`,
    converted: converting,
    sizeBytes: image.sizeBytes,
  }
}

/**
 * Build the lookup used to rewrite every reference.
 *
 * Keyed by the local reference exactly as it is written. Both the root-relative form
 * (`/images/x.png`) and the absolute form (`https://www.josemadrid.net/images/x.png`) map to the
 * same blob URL, because the codebase uses both — metadata and email templates need absolute URLs.
 */
export function buildRewriteMap(
  entries: MigrationEntry[],
  storeBaseUrl: string,
  siteOrigins: string[]
): Map<string, string> {
  const map = new Map<string, string>()
  const base = storeBaseUrl.replace(/\/+$/, '')

  for (const entry of entries) {
    const blobUrl = `${base}/${entry.blobPathname}`
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
}

/**
 * Replace every known image reference in a blob of text.
 *
 * Longest key first: `https://www.josemadrid.net/images/x.png` contains `/images/x.png`, so
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

  for (const key of keys) {
    const to = map.get(key)!
    const pattern = new RegExp(`${escapeRegExp(key)}(?=["'\`)\\s,;>}]|$)`, 'g')
    const matches = out.match(pattern)
    if (!matches?.length) continue

    out = out.replace(pattern, to)
    replacements.push({ from: key, to, count: matches.length })
  }

  return { text: out, replacements }
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
