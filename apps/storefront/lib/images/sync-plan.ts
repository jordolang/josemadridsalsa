/**
 * Planning logic for `npm run images:sync`.
 *
 * Everything here is pure: given the files on disk, what is already in Blob, and the product
 * catalogue, decide what would be uploaded and what would be linked. The script does the I/O.
 *
 * Split this way on purpose — the decisions worth getting right (does this file already exist,
 * which product does it belong to, does linking it destroy an existing image) are exactly the
 * decisions that are miserable to verify against a live blob store and a live database.
 */

export type UploadDecision =
  /** Not in the store yet. */
  | 'UPLOAD'
  /** Same pathname, same content hash — nothing to do. */
  | 'SKIP_UNCHANGED'
  /** Same pathname, different content — the URL stays stable and the image is replaced. */
  | 'REPLACE'

export type LinkAction =
  /** Set `Product.featuredImage`. */
  | 'FEATURED'
  /** Append to `Product.images`. */
  | 'APPEND'
  /** Already linked to this product; nothing to change. */
  | 'ALREADY_LINKED'
  /** No product matched, or linking was not requested. */
  | 'NONE'

export interface SourceFile {
  /** Absolute path on disk. */
  sourcePath: string
  fileName: string
  sizeBytes: number
  sha256: string
}

/** What the manifest remembers about a pathname we have uploaded before. */
export interface ManifestEntry {
  sha256: string
  url: string
  sizeBytes: number
  uploadedAt: string
}

export interface ProductRef {
  id: string
  name: string
  slug: string
  sku: string
  featuredImage: string | null
  images: string[]
}

export interface ProductMatch {
  product: ProductRef
  /** Which field the filename matched on, for the reviewer to sanity-check. */
  matchedOn: 'slug' | 'sku' | 'name'
}

export interface FilePlan {
  source: SourceFile
  /** Where it lands in the blob store, e.g. `products/mango-habanero.png`. */
  blobPathname: string
  decision: UploadDecision
  /** Present only when the pathname is already known. */
  existingUrl: string | null
  match: ProductMatch | null
  linkAction: LinkAction
  /** Set when a file cannot be handled; it is reported and skipped, never guessed at. */
  problem: string | null
}

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'] as const

/** Files that are never images, however they are named. Kept out of the plan entirely. */
export function isImageFile(fileName: string): boolean {
  if (fileName.startsWith('.')) return false
  const lower = fileName.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Formats that are already web-optimised; re-encoding them only loses quality. */
const ALREADY_OPTIMISED = ['.webp', '.avif'] as const

/**
 * Path segments whose images must keep their original format.
 *
 * Open Graph images are fetched by social crawlers (Facebook, X, LinkedIn, iMessage), and WebP
 * support across those crawlers is inconsistent to absent — a WebP OG image renders as a blank
 * card on several of them. These stay PNG/JPEG regardless of the conversion setting.
 */
export const NO_CONVERT_SEGMENTS = ['opengraph', 'og', 'favicon'] as const

/**
 * Should this file be re-encoded to WebP?
 *
 * Conversion is the default because it is what actually shrinks the payload for everything not
 * rendered through `next/image` — email templates, raw `<img>` tags, and the blob store itself.
 * It is refused for formats that are already optimised, for animated GIFs, and for crawler-facing
 * images.
 */
export function shouldConvertToWebp(
  fileName: string,
  relativeDir: string,
  convert: boolean
): boolean {
  if (!convert) return false

  const lower = fileName.toLowerCase()
  if (ALREADY_OPTIMISED.some((ext) => lower.endsWith(ext))) return false
  // Converting an animated GIF to still WebP would silently drop the animation.
  if (lower.endsWith('.gif')) return false

  const segments = relativeDir.toLowerCase().split('/').filter(Boolean)
  return !segments.some((s) =>
    NO_CONVERT_SEGMENTS.includes(s as (typeof NO_CONVERT_SEGMENTS)[number])
  )
}

/** The filename a file ends up with once conversion policy is applied. */
export function outputFileName(fileName: string, converting: boolean): string {
  return converting ? fileName.replace(/\.[^.]+$/, '.webp') : fileName
}

/**
 * Reduce a filename to the slug form used for matching.
 *
 * `Mango Habanero (2).PNG` -> `mango-habanero`. The trailing `(2)` that every OS adds when you
 * save a second copy is stripped, because otherwise the most common real-world filename silently
 * fails to match its product.
 */
export function filenameToSlug(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '')
  return withoutExt
    .replace(/[\s_]+/g, '-')
    .replace(/\((\d+)\)\s*$/, '')
    .replace(/-+\d+$/, (m) => m) // a trailing -2 may be meaningful (verde-2), so keep it
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/** Normalise a product name the same way, so `Mango Habanero` and `mango-habanero.png` meet. */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Filename slug -> the identifier to look the product up by.
 *
 * For photo sets named before the catalogue slugs settled, where no rule connects the two.
 * Keyed and valued by `filenameToSlug` form; the value is resolved exactly like a filename, so it
 * can name a slug, a SKU or a product name.
 */
export type FilenameAliases = Record<string, string>

/**
 * Drop a trailing `salsa` from a slug.
 *
 * The catalogue is inconsistent about the suffix — `mango-mild-salsa` and `spanish-verde-mild` are
 * both salsas — so a photo named after the flavour misses its product half the time.
 */
function withoutSalsaSuffix(slug: string): string {
  return slug.replace(/-salsa$/, '')
}

/**
 * Find the product a filename refers to.
 *
 * Tried in order of how deliberate the identifier is: an explicit alias, then slug (chosen for
 * URLs), then SKU (chosen for inventory), then the product name (incidental), and finally the same
 * comparison ignoring a trailing `salsa`. An ambiguous match returns null rather than picking one —
 * silently attaching a photo to the wrong product is worse than not attaching it.
 */
export function matchProduct(
  fileName: string,
  products: ProductRef[],
  aliases: FilenameAliases = {}
): ProductMatch | null {
  const fromFile = filenameToSlug(fileName)
  if (!fromFile) return null

  const slug = aliases[fromFile] ? nameToSlug(aliases[fromFile]) : fromFile

  const bySlug = products.find((p) => p.slug.toLowerCase() === slug)
  if (bySlug) return { product: bySlug, matchedOn: 'slug' }

  const bySku = products.find((p) => p.sku.toLowerCase() === slug)
  if (bySku) return { product: bySku, matchedOn: 'sku' }

  const byName = products.filter((p) => nameToSlug(p.name) === slug)
  if (byName.length === 1) return { product: byName[0], matchedOn: 'name' }

  const relaxed = withoutSalsaSuffix(slug)
  const bySlugRelaxed = products.filter((p) => withoutSalsaSuffix(p.slug.toLowerCase()) === relaxed)
  if (bySlugRelaxed.length === 1) return { product: bySlugRelaxed[0], matchedOn: 'slug' }

  const byNameRelaxed = products.filter((p) => withoutSalsaSuffix(nameToSlug(p.name)) === relaxed)
  if (byNameRelaxed.length === 1) return { product: byNameRelaxed[0], matchedOn: 'name' }

  return null
}

/** Build the blob pathname for a file, under the given prefix. */
export function blobPathnameFor(fileName: string, prefix: string): string {
  const cleanPrefix = prefix.replace(/^\/+/, '').replace(/\/*$/, '')
  return cleanPrefix ? `${cleanPrefix}/${fileName}` : fileName
}

/**
 * Decide whether a file needs uploading.
 *
 * Content-hash keyed: re-running the sync after no change is free and cannot duplicate anything.
 * A changed file keeps the same pathname, so the public URL never moves and every listing already
 * pointing at it updates at once.
 */
export function decideUpload(file: SourceFile, existing: ManifestEntry | undefined): UploadDecision {
  if (!existing) return 'UPLOAD'
  return existing.sha256 === file.sha256 ? 'SKIP_UNCHANGED' : 'REPLACE'
}

/**
 * Decide how a matched product should be linked to the resulting URL.
 *
 * Never destructive: `featured` overwrites `featuredImage` only when explicitly asked, and the
 * previous featured image is preserved by being appended to `images` by the caller. An append that
 * would duplicate a URL already on the product is reported as ALREADY_LINKED instead.
 */
export function decideLink(
  match: ProductMatch | null,
  url: string,
  options: { link: boolean; featured: boolean }
): LinkAction {
  if (!options.link || !match) return 'NONE'

  const { product } = match
  const alreadyFeatured = product.featuredImage === url
  const alreadyInImages = product.images.includes(url)

  if (options.featured) {
    return alreadyFeatured ? 'ALREADY_LINKED' : 'FEATURED'
  }
  return alreadyInImages ? 'ALREADY_LINKED' : 'APPEND'
}

export interface BuildPlanInput {
  files: SourceFile[]
  manifest: Record<string, ManifestEntry>
  products: ProductRef[]
  prefix: string
  link: boolean
  featured: boolean
  /** Base URL of the blob store, used to predict the URL of a not-yet-uploaded file. */
  storeBaseUrl: string | null
  /** Filenames that cannot be matched by rule alone. */
  aliases?: FilenameAliases
}

/**
 * Turn a directory listing into an ordered, reviewable plan.
 *
 * Nothing here touches Blob or the database. The script prints this, and only mutates anything
 * when `--apply` is passed — so the default behaviour of the command is to tell you what it would
 * do, which is the right default for something that writes to a live store.
 */
export function buildPlan(input: BuildPlanInput): FilePlan[] {
  const { files, manifest, products, prefix, link, featured, storeBaseUrl, aliases } = input

  return files
    .slice()
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .map((source): FilePlan => {
      const blobPathname = blobPathnameFor(source.fileName, prefix)
      const existing = manifest[blobPathname]
      const decision = decideUpload(source, existing)

      // Predict the URL so the plan can show the exact linking outcome before anything uploads.
      const url =
        existing?.url ?? (storeBaseUrl ? `${storeBaseUrl.replace(/\/+$/, '')}/${blobPathname}` : null)

      const match = matchProduct(source.fileName, products, aliases)

      let problem: string | null = null
      if (link && !match) {
        problem = `No product matches "${filenameToSlug(source.fileName)}" — uploaded but not linked.`
      }
      if (link && match && !url) {
        problem = 'Cannot determine the blob URL until the store base URL is known.'
      }

      const linkAction = url ? decideLink(match, url, { link, featured }) : 'NONE'

      return {
        source,
        blobPathname,
        decision,
        existingUrl: existing?.url ?? null,
        match,
        linkAction,
        problem,
      }
    })
}

/** One-line human summary of a plan, for the command's final output. */
export function summarisePlan(plan: FilePlan[]): {
  upload: number
  replace: number
  unchanged: number
  linked: number
  unmatched: number
} {
  return {
    upload: plan.filter((p) => p.decision === 'UPLOAD').length,
    replace: plan.filter((p) => p.decision === 'REPLACE').length,
    unchanged: plan.filter((p) => p.decision === 'SKIP_UNCHANGED').length,
    linked: plan.filter((p) => p.linkAction === 'FEATURED' || p.linkAction === 'APPEND').length,
    unmatched: plan.filter((p) => p.problem !== null).length,
  }
}
