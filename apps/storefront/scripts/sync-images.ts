/**
 * Upload images from a folder to Vercel Blob and optionally link them to products.
 *
 *   npm run images:sync                              # dry run over ~/Desktop/jms-images
 *   npm run images:sync -- --apply                   # upload
 *   npm run images:sync -- --link --apply            # upload and attach to matching products
 *   npm run images:sync -- --link --featured --apply # ...as the main product photo
 *   npm run images:sync -- ~/Downloads/shoot --prefix marketing --apply
 *   npm run images:sync -- --no-webp --apply         # keep original formats
 *   npm run images:labels -- --apply                 # the flat label scans, onto their products
 *
 * Images are converted to WebP by default — typically a 90%+ size reduction, and it applies
 * everywhere, including email templates and raw <img> tags that `next/image` never touches.
 * Open Graph images, animated GIFs and already-optimised formats are left alone (see
 * `shouldConvertToWebp`).
 *
 * Dry run is the default: this writes to a live store and a live database, so nothing happens
 * until `--apply`. The source folder lives outside the repo, so nothing here can bloat git.
 */

import { createHash } from 'node:crypto'
import { readdir, readFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { list, put } from '@vercel/blob'
import { PrismaClient } from '@prisma/client'
import { LABEL_FILENAME_ALIASES } from '@/lib/images/label-aliases'
import {
  buildPlan,
  isImageFile,
  outputFileName,
  shouldConvertToWebp,
  summarisePlan,
  type FilePlan,
  type ManifestEntry,
  type ProductRef,
  type SourceFile,
} from '../lib/images/sync-plan'

const DEFAULT_SOURCE = path.join(homedir(), 'Desktop', 'jms-images')
const MANIFEST_PATH = path.join(process.cwd(), '.image-sync-manifest.json')
const WEBP_QUALITY = 82

interface Options {
  sourceDir: string
  prefix: string
  link: boolean
  featured: boolean
  apply: boolean
  webp: boolean
  /** Label-scan mode: its own prefix and filename aliases, and never the main product photo. */
  labels: boolean
}

function parseArgs(argv: string[]): Options {
  const positional = argv.filter((a) => !a.startsWith('--'))
  const flag = (name: string) => argv.includes(`--${name}`)
  const value = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    if (hit) return hit.slice(name.length + 3)
    const idx = argv.indexOf(`--${name}`)
    return idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--') ? argv[idx + 1] : undefined
  }

  const prefixValue = value('prefix')
  const labels = flag('labels')
  return {
    sourceDir: positional[0] ? path.resolve(positional[0].replace(/^~/, homedir())) : DEFAULT_SOURCE,
    prefix: (prefixValue ?? (labels ? 'products/labels' : 'products')).replace(/^\/+|\/+$/g, ''),
    link: flag('link'),
    // A label belongs in the gallery beside the jar photo, never in front of it.
    featured: flag('featured') && !labels,
    apply: flag('apply'),
    webp: !flag('no-webp'),
    labels,
  }
}

async function readManifest(): Promise<Record<string, ManifestEntry>> {
  if (!existsSync(MANIFEST_PATH)) return {}
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Record<string, ManifestEntry>
  } catch {
    // A corrupt cache must not stop a sync — worst case every file re-uploads, which is idempotent.
    console.warn('  (manifest unreadable, treating every file as new)')
    return {}
  }
}

let sharpModule: typeof import('sharp') | null = null
async function loadSharp() {
  if (sharpModule) return sharpModule
  try {
    sharpModule = (await import('sharp')).default as unknown as typeof import('sharp')
    return sharpModule
  } catch {
    throw new Error(
      'WebP conversion needs sharp. Run: npm install --legacy-peer-deps\n' +
        'Or pass --no-webp to upload the originals unchanged.'
    )
  }
}

/** Read a file and apply conversion policy, returning what will actually be uploaded. */
async function prepare(
  sourcePath: string,
  fileName: string,
  prefix: string,
  webp: boolean
): Promise<{ buffer: Buffer; fileName: string; converted: boolean }> {
  const original = await readFile(sourcePath)
  const converting = shouldConvertToWebp(fileName, prefix, webp)
  if (!converting) return { buffer: original, fileName, converted: false }

  const sharp = await loadSharp()
  const buffer = await sharp(original).webp({ quality: WEBP_QUALITY }).toBuffer()
  return { buffer, fileName: outputFileName(fileName, true), converted: true }
}

interface Collected extends SourceFile {
  originalName: string
  originalBytes: number
  converted: boolean
}

async function collectFiles(dir: string, prefix: string, webp: boolean): Promise<Collected[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: Collected[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !isImageFile(entry.name)) continue

    const sourcePath = path.join(dir, entry.name)
    const originalBytes = (await stat(sourcePath)).size
    // Converted here so the hash and the reported size describe what actually lands in the store.
    const prepared = await prepare(sourcePath, entry.name, prefix, webp)

    files.push({
      sourcePath,
      fileName: prepared.fileName,
      originalName: entry.name,
      originalBytes,
      converted: prepared.converted,
      sizeBytes: prepared.buffer.byteLength,
      sha256: createHash('sha256').update(prepared.buffer).digest('hex'),
    })
  }

  return files
}

/** Derive the store origin so a dry run can show the exact URL a file will get. */
async function resolveStoreBaseUrl(manifest: Record<string, ManifestEntry>): Promise<string | null> {
  const known = Object.values(manifest)[0]?.url
  if (known) return new URL(known).origin

  try {
    const { blobs } = await list({ limit: 1 })
    if (blobs[0]) return new URL(blobs[0].url).origin
  } catch {
    // An unreachable store is reported by the upload step; a dry run still shows everything else.
  }
  return null
}

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(2)} MB`

function describe(plan: FilePlan, collected: Collected): string {
  const decision = { UPLOAD: 'upload   ', REPLACE: 'replace  ', SKIP_UNCHANGED: 'unchanged' }[
    plan.decision
  ]

  const saving = collected.converted
    ? `${mb(collected.originalBytes)} → ${mb(collected.sizeBytes)}` +
      ` (−${Math.round((1 - collected.sizeBytes / collected.originalBytes) * 100)}%)`
    : mb(collected.sizeBytes)

  const link =
    plan.linkAction === 'FEATURED'
      ? `→ featured on ${plan.match!.product.name}`
      : plan.linkAction === 'APPEND'
        ? `→ added to ${plan.match!.product.name}`
        : plan.linkAction === 'ALREADY_LINKED'
          ? `→ already on ${plan.match!.product.name}`
          : ''

  return `  ${decision}  ${plan.blobPathname.padEnd(42)} ${saving.padStart(26)}  ${link}`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set.')
    console.error('Get it from Vercel → Storage → josemadridsalsa-blob, then add it to')
    console.error('apps/storefront/.env.local as BLOB_READ_WRITE_TOKEN="…".')
    process.exit(1)
  }

  if (!existsSync(options.sourceDir)) {
    await mkdir(options.sourceDir, { recursive: true })
    console.log(`Created ${options.sourceDir}`)
    console.log('Drop images in there and run this again.')
    return
  }
  if (!(await stat(options.sourceDir)).isDirectory()) {
    console.error(`${options.sourceDir} is not a directory.`)
    process.exit(1)
  }

  console.log(`Source   ${options.sourceDir}`)
  console.log(`Prefix   ${options.prefix}/`)
  if (options.labels) console.log('Labels   appended to the product gallery, never featured')
  console.log(`Convert  ${options.webp ? `WebP q${WEBP_QUALITY} (OG images and GIFs kept as-is)` : 'off'}`)
  console.log(`Mode     ${options.apply ? 'APPLY — will upload and write' : 'dry run'}\n`)

  const manifest = await readManifest()
  const [files, storeBaseUrl] = await Promise.all([
    collectFiles(options.sourceDir, options.prefix, options.webp),
    resolveStoreBaseUrl(manifest),
  ])

  if (files.length === 0) {
    console.log('No images found. Supported: png, jpg, jpeg, webp, avif, gif.')
    return
  }

  const byName = new Map(files.map((f) => [f.fileName, f]))
  const prisma = new PrismaClient()

  try {
    const products: ProductRef[] = options.link
      ? await prisma.product.findMany({
          select: { id: true, name: true, slug: true, sku: true, featuredImage: true, images: true },
        })
      : []

    const plan = buildPlan({
      files,
      manifest,
      products,
      prefix: options.prefix,
      link: options.link,
      featured: options.featured,
      storeBaseUrl,
      aliases: options.labels ? LABEL_FILENAME_ALIASES : undefined,
    })

    for (const item of plan) console.log(describe(item, byName.get(item.source.fileName)!))

    const problems = plan.filter((p) => p.problem)
    if (problems.length) {
      console.log('\nNot linked:')
      for (const p of problems) console.log(`  ${p.source.fileName}: ${p.problem}`)
    }

    const summary = summarisePlan(plan)
    const before = files.reduce((n, f) => n + f.originalBytes, 0)
    const after = files.reduce((n, f) => n + f.sizeBytes, 0)
    console.log(
      `\n${summary.upload} new, ${summary.replace} replaced, ${summary.unchanged} unchanged, ` +
        `${summary.linked} linked, ${summary.unmatched} unmatched`
    )
    if (options.webp && after < before) {
      console.log(`${mb(before)} → ${mb(after)} (−${Math.round((1 - after / before) * 100)}%)`)
    }

    if (!options.apply) {
      console.log('\nDry run. Re-run with --apply to upload.')
      return
    }

    console.log('')
    for (const item of plan) {
      // An unchanged file still needs its link applied: a label uploaded while it matched no
      // product gets one once an alias is added, and re-running the command is how that lands.
      let url = item.existingUrl

      if (item.decision !== 'SKIP_UNCHANGED') {
        const collected = byName.get(item.source.fileName)!
        // Re-prepared rather than held in memory: a full shoot would otherwise sit in RAM at once.
        const prepared = await prepare(
          collected.sourcePath,
          collected.originalName,
          options.prefix,
          options.webp
        )

        // addRandomSuffix:false keeps the filename in the URL, so links stay predictable and a
        // re-upload replaces the image everywhere it is already referenced.
        const result = await put(item.blobPathname, prepared.buffer, {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
        })

        manifest[item.blobPathname] = {
          sha256: item.source.sha256,
          url: result.url,
          sizeBytes: item.source.sizeBytes,
          uploadedAt: new Date().toISOString(),
        }
        url = result.url
        console.log(`  uploaded ${result.url}`)
      }

      if (!url || !item.match || item.linkAction === 'NONE' || item.linkAction === 'ALREADY_LINKED') {
        continue
      }

      const { product } = item.match
      if (item.linkAction === 'FEATURED') {
        // Preserve whatever was featured before rather than dropping it on the floor.
        const carried =
          product.featuredImage && !product.images.includes(product.featuredImage)
            ? [...product.images, product.featuredImage]
            : product.images

        await prisma.product.update({
          where: { id: product.id },
          data: { featuredImage: url, images: carried.filter((u) => u !== url) },
        })
        console.log(`    featured on ${product.name}`)
      } else {
        await prisma.product.update({
          where: { id: product.id },
          data: { images: { push: url } },
        })
        console.log(`    added to ${product.name}`)
      }
    }

    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    console.log(`\nManifest updated: ${MANIFEST_PATH}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
