/**
 * Move the committed `public/images` tree to Vercel Blob as WebP, then repoint every reference.
 *
 *   npm run images:migrate                 # dry run — shows every upload and every rewrite
 *   npm run images:migrate -- --apply      # upload, then rewrite code and database
 *   npm run images:migrate -- --upload     # upload only, write the map, change nothing else
 *   npm run images:migrate -- --rewrite    # rewrite only, using the map from a previous --upload
 *
 * Run it in two stages the first time (`--upload`, inspect, then `--rewrite`) so the uploads are
 * verified before 179 references move.
 *
 * Local files are never deleted. They are already permanent in git history, so removing them
 * reclaims nothing, and keeping them means a missed reference degrades to the old image rather
 * than a 404.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { list, put } from '@vercel/blob'
import { PrismaClient } from '@prisma/client'
import {
  buildRewriteMap,
  planFile,
  rewriteText,
  summariseMigration,
  type LocalImage,
  type MigrationEntry,
} from '../lib/images/migrate-plan'
import { isImageFile, shouldConvertToWebp } from '../lib/images/sync-plan'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images')
const MAP_PATH = path.join(process.cwd(), '.image-migration-map.json')
const WEBP_QUALITY = 82

/** Directories whose source files may contain image references. */
const CODE_DIRS = ['app', 'components', 'lib', 'emails'] as const
const CODE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.json'] as const

const SITE_ORIGINS = ['https://www.josemadrid.net', 'https://josemadrid.net']

interface Options {
  apply: boolean
  upload: boolean
  rewrite: boolean
  webp: boolean
}

function parseArgs(argv: string[]): Options {
  const flag = (n: string) => argv.includes(`--${n}`)
  const uploadOnly = flag('upload')
  const rewriteOnly = flag('rewrite')
  return {
    apply: flag('apply') || uploadOnly || rewriteOnly,
    // With neither stage flag, do both.
    upload: uploadOnly || !rewriteOnly,
    rewrite: rewriteOnly || !uploadOnly,
    webp: !flag('no-webp'),
  }
}

async function walk(dir: string, base: string): Promise<LocalImage[]> {
  const out: LocalImage[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)))
      continue
    }
    if (!entry.isFile() || !isImageFile(entry.name)) continue
    out.push({
      relativePath: path.relative(base, full).split(path.sep).join('/'),
      sizeBytes: (await stat(full)).size,
    })
  }
  return out
}

async function convert(sourcePath: string, converting: boolean): Promise<Buffer> {
  const original = await readFile(sourcePath)
  if (!converting) return original
  const sharp = (await import('sharp')).default
  return sharp(original).webp({ quality: WEBP_QUALITY }).toBuffer()
}

async function resolveStoreBaseUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ limit: 1 })
    if (blobs[0]) return new URL(blobs[0].url).origin
  } catch {
    /* reported by the caller */
  }
  return null
}

async function collectCodeFiles(): Promise<string[]> {
  const out: string[] = []
  for (const dir of CODE_DIRS) {
    const full = path.join(process.cwd(), dir)
    if (!existsSync(full)) continue
    const stack = [full]
    while (stack.length) {
      const current = stack.pop()!
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const p = path.join(current, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) stack.push(p)
        } else if (CODE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          out.push(p)
        }
      }
    }
  }
  return out
}

const mb = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set.')
    console.error('Get it from Vercel → Storage → josemadridsalsa-blob, then add it to')
    console.error('apps/storefront/.env.local as BLOB_READ_WRITE_TOKEN="…".')
    process.exit(1)
  }
  if (!existsSync(IMAGES_DIR)) {
    console.error(`${IMAGES_DIR} does not exist.`)
    process.exit(1)
  }

  console.log(`Mode     ${options.apply ? 'APPLY' : 'dry run'}`)
  console.log(`Stages   ${[options.upload && 'upload', options.rewrite && 'rewrite'].filter(Boolean).join(' + ')}`)
  console.log(`Convert  ${options.webp ? `WebP q${WEBP_QUALITY} (OG images and GIFs kept as-is)` : 'off'}\n`)

  const images = await walk(IMAGES_DIR, PUBLIC_DIR)
  const entries: MigrationEntry[] = images.map((i) => planFile(i, options.webp))
  const summary = summariseMigration(entries)

  console.log(
    `${summary.files} images, ${mb(summary.bytes)} — ${summary.converted} to convert, ` +
      `${summary.kept} kept as-is\n`
  )

  let storeBaseUrl = await resolveStoreBaseUrl()
  let map = new Map<string, string>()

  // ---- stage 1: upload ----
  if (options.upload) {
    let uploadedBytes = 0
    for (const entry of entries) {
      const sourcePath = path.join(PUBLIC_DIR, entry.localRef.replace(/^\//, ''))
      if (!options.apply) {
        console.log(
          `  plan  ${entry.localRef}  →  ${entry.originalBlobPathname}${entry.converted ? ` + ${entry.blobPathname}` : ''}`
        )
        continue
      }

      // The original is always uploaded under its own name, and the conversion beside it. A
      // consumer that cannot read WebP — a social crawler, Google Business — then still has a URL
      // to point at, and nothing is lost by the migration that was not already in git.
      const original = await convert(sourcePath, false)
      const originalPut = await put(entry.originalBlobPathname, original, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      uploadedBytes += original.byteLength
      storeBaseUrl ??= new URL(originalPut.url).origin

      if (entry.converted) {
        const webp = await convert(sourcePath, true)
        await put(entry.blobPathname, webp, {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
        })
        uploadedBytes += webp.byteLength
        console.log(
          `  up    ${entry.localRef}  →  ${mb(original.byteLength)} original + ${mb(webp.byteLength)} webp`
        )
      } else {
        console.log(`  up    ${entry.localRef}  →  ${mb(original.byteLength)}`)
      }
    }
    if (options.apply) {
      console.log(`\nUploaded ${mb(uploadedBytes)} (was ${mb(summary.bytes)}).`)
    }
  }

  if (!storeBaseUrl) {
    console.log('\nStore URL unknown — run with --apply (or --upload) first so it can be read back.')
    if (!options.apply) console.log('Dry run complete.')
    return
  }

  map = buildRewriteMap(entries, storeBaseUrl, SITE_ORIGINS)
  // A blog cover is a crawler-facing image: it is the article's og:image and the photo a Google
  // Business cross-post attaches, and neither reliably accepts WebP. Covers resolve to the
  // original upload; the page itself loses nothing, because next/image re-encodes on the fly.
  const originalMap = buildRewriteMap(entries, storeBaseUrl, SITE_ORIGINS, 'original')

  if (options.apply && options.upload) {
    await writeFile(
      MAP_PATH,
      `${JSON.stringify(Object.fromEntries(map), null, 2)}\n`,
      'utf8'
    )
    console.log(`Map written: ${MAP_PATH}`)
  }

  if (!options.rewrite) {
    console.log('\nUpload stage done. Inspect the images, then run with --rewrite.')
    return
  }

  // ---- stage 2: rewrite code ----
  console.log('\nCode:')
  let codeFiles = 0
  let codeRefs = 0
  const review: Array<{ file: string; ref: string; count: number }> = []
  for (const file of await collectCodeFiles()) {
    const before = await readFile(file, 'utf8')
    const { text, replacements, needsReview } = rewriteText(before, map)
    for (const r of needsReview) {
      review.push({ file: path.relative(process.cwd(), file), ref: r.ref, count: r.count })
    }
    if (!replacements.length) continue

    codeFiles += 1
    codeRefs += replacements.reduce((n, r) => n + r.count, 0)
    console.log(
      `  ${path.relative(process.cwd(), file)} — ${replacements.reduce((n, r) => n + r.count, 0)} ref(s)`
    )
    if (options.apply) await writeFile(file, text, 'utf8')
  }
  console.log(`  ${codeRefs} reference(s) across ${codeFiles} file(s)`)

  if (review.length) {
    console.log('\nNeeds review — a path inside a template literal, left unchanged:')
    for (const r of review) console.log(`  ${r.file}  ${r.ref}  (${r.count})`)
    console.log('  Replacing only the path would leave the variable stranded before an absolute URL.')
  }

  // ---- stage 3: rewrite database ----
  console.log('\nDatabase:')
  const prisma = new PrismaClient()
  try {
    let dbRows = 0

    const products = await prisma.product.findMany({
      select: { id: true, name: true, featuredImage: true, images: true },
    })
    for (const p of products) {
      const featured = p.featuredImage ? rewriteText(p.featuredImage, map) : null
      const images = p.images.map((u) => rewriteText(u, map))
      const changed =
        (featured?.replacements.length ?? 0) > 0 || images.some((i) => i.replacements.length > 0)
      if (!changed) continue

      dbRows += 1
      console.log(`  product ${p.name}`)
      if (options.apply) {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            featuredImage: featured ? featured.text : p.featuredImage,
            images: images.map((i) => i.text),
          },
        })
      }
    }

    const posts = await prisma.blogPost.findMany({
      where: { coverImage: { not: null } },
      select: { id: true, title: true, coverImage: true },
    })
    for (const post of posts) {
      const rewritten = rewriteText(post.coverImage ?? '', originalMap)
      if (!rewritten.replacements.length) continue

      dbRows += 1
      console.log(`  blog post ${post.title}`)
      if (options.apply) {
        await prisma.blogPost.update({ where: { id: post.id }, data: { coverImage: rewritten.text } })
      }
    }

    console.log(`  ${dbRows} row(s)`)
  } finally {
    await prisma.$disconnect()
  }

  console.log(
    options.apply
      ? '\nDone. Local files were left in place as a fallback; delete them in a separate commit once verified.'
      : '\nDry run. Re-run with --apply to make these changes.'
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
