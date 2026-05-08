/**
 * Export active products into TikTok Shop's official bulk-upload template.
 *
 * Strategy: treat the template .xlsx as a zip archive (jszip) and write a
 * new <row> block directly into the Template sheet's sheet1.xml. This
 * preserves every reference sheet, data-validation rule, and cell style
 * in the template without paying ExcelJS's multi-minute parse cost on a
 * 2000-row template with hidden attribute lists.
 *
 * Usage:
 *   DB="$DATABASE_URL_UNPOOLED" \
 *   TIKTOK_TEMPLATE="/path/to/..._template.xlsx" \
 *   npx tsx scripts/export-tiktok-shop-products.ts
 *
 * Output: `tiktok-shop-products.xlsx` at the repo root.
 */

import { PrismaClient } from '@prisma/client'
import JSZip from 'jszip'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://www.josemadrid.net'
const OUTPUT_FILENAME = 'tiktok-shop-products.xlsx'

// Optional split: when set, products are written to multiple xlsx files
// (tiktok-shop-products-1.xlsx, -2.xlsx, …) with at most CHUNK_SIZE rows
// each. Useful when TikTok caps per-upload row counts. Unset → single file.
const CHUNK_SIZE = process.env.CHUNK_SIZE
  ? Math.max(1, Number(process.env.CHUNK_SIZE))
  : null

const TIKTOK_CATEGORY = 'Staples & Cooking Essentials/Cooking Sauces'
const TIKTOK_BRAND = 'Jose Madrid Salsa'
const REGION_OF_ORIGIN = 'United States'
const MANUFACTURER = 'Jose Madrid Salsa'
const STORAGE_TEMPERATURE = 'Ambient'
const AGE_WARNING = 'No Age Restriction'

const DEFAULT_PARCEL_LENGTH_IN = 3
const DEFAULT_PARCEL_WIDTH_IN = 3
const DEFAULT_PARCEL_HEIGHT_IN = 5

const DATA_START_ROW = 6

const KEYS = {
  category: 'category',
  brand: 'brand',
  productName: 'product_name',
  productDescription: 'product_description',
  mainImage: 'main_image',
  gtinType: 'gtin_type',
  gtinCode: 'gtin_code',
  parcelWeight: 'parcel_weight',
  parcelLength: 'parcel_length',
  parcelWidth: 'parcel_width',
  parcelHeight: 'parcel_height',
  price: 'price',
  quantity: 'quantity',
  sellerSku: 'seller_sku',
  regionOfOrigin: 'product_property/100336',
  ingredients: 'product_property/100346',
  ageWarning: 'product_property/100475',
  manufacturer: 'product_property/100492',
  storageTemperature: 'product_property/102207',
}

function xmlEscape(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlUnescape(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function toAbsoluteUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${APP_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}

type Cell =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }

function cellXml(ref: string, cell: Cell | undefined): string {
  if (!cell) return ''
  if (cell.type === 'number') {
    if (!Number.isFinite(cell.value)) return ''
    return `<c r="${ref}"><v>${cell.value}</v></c>`
  }
  const v = cell.value
  if (!v) return ''
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`
}

function parseSharedStrings(xml: string): string[] {
  const items: string[] = []
  const siMatches = Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g))
  for (const si of siMatches) {
    const inner = si[1]
    const tMatches = Array.from(inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
    const text = tMatches.map((t) => t[1]).join('')
    items.push(xmlUnescape(text))
  }
  return items
}

function parseKeyToLetter(
  sheetXml: string,
  sharedStrings: string[],
): Map<string, string> {
  const map = new Map<string, string>()
  const row1Match = sheetXml.match(/<row[^>]*\br="1"[^>]*>([\s\S]*?)<\/row>/)
  if (!row1Match) return map
  const row1 = row1Match[1]

  const cellMatches = Array.from(row1.matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g))
  for (const m of cellMatches) {
    const attrs = m[1]
    const inner = m[2]
    const rMatch = attrs.match(/\br="([A-Z]+)1"/)
    if (!rMatch) continue
    const col = rMatch[1]
    const typeMatch = attrs.match(/\bt="([^"]+)"/)
    const type = typeMatch?.[1]

    let value = ''
    if (type === 's') {
      const v = inner.match(/<v>(\d+)<\/v>/)
      if (v) value = sharedStrings[Number(v[1])] ?? ''
    } else if (type === 'inlineStr') {
      const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)
      if (t) value = xmlUnescape(t[1])
    } else {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)
      if (v) value = xmlUnescape(v[1])
    }
    if (value) map.set(value.trim(), col)
  }
  return map
}

async function main() {
  const url = process.env.DB ?? process.env.DATABASE_URL
  if (!url) {
    console.error(
      'Set DB to your direct Postgres URL (DATABASE_URL_UNPOOLED from .env.vercel.production).',
    )
    process.exit(1)
  }
  const templatePath =
    process.env.TIKTOK_TEMPLATE ??
    '/Users/jordanlang/Downloads/Tiktoksellercenter_Food & Beverages_20260421_Cooking Sauces_template.xlsx'

  console.log('Loading template...')
  const templateBuf = await readFile(templatePath)
  const zip = await JSZip.loadAsync(templateBuf)

  const sheetFile = zip.file('xl/worksheets/sheet1.xml')
  if (!sheetFile) throw new Error('sheet1.xml not found in template')
  const sheetXml = await sheetFile.async('string')

  const sharedStringsFile = zip.file('xl/sharedStrings.xml')
  const sharedStrings = sharedStringsFile
    ? parseSharedStrings(await sharedStringsFile.async('string'))
    : []

  const keyToCol = parseKeyToLetter(sheetXml, sharedStrings)
  console.log(`Indexed ${keyToCol.size} column keys from template row 1`)

  const missing = Object.values(KEYS).filter((k) => !keyToCol.has(k))
  if (missing.length > 0) {
    console.warn('Warning — missing expected template keys:', missing)
  }

  console.log('Connecting to database...')
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { category: { select: { name: true } } },
  })
  await prisma.$disconnect()
  console.log(`Loaded ${products.length} products`)

  type Product = (typeof products)[number]

  /** Render one product as a `<row>` XML string for the given Excel row index. */
  function buildRowXml(p: Product, rowNum: number): string {
    const cells: Record<string, Cell> = {}
    const put = (keyName: keyof typeof KEYS, cell: Cell) => {
      const colLetter = keyToCol.get(KEYS[keyName])
      if (colLetter) cells[colLetter] = cell
    }

    const mainImage =
      toAbsoluteUrl(p.featuredImage) || toAbsoluteUrl(p.images[0] ?? null)
    const otherImages = p.images
      .filter((img) => img && img !== p.featuredImage)
      .map(toAbsoluteUrl)
      .filter(Boolean)

    const dims = (p.dimensions ?? {}) as {
      length?: number
      width?: number
      height?: number
    }
    const weightLb = p.weight ? Number(p.weight) / 16 : 1

    put('category', { type: 'string', value: TIKTOK_CATEGORY })
    put('brand', { type: 'string', value: TIKTOK_BRAND })
    put('productName', { type: 'string', value: p.name })
    put('productDescription', { type: 'string', value: p.description ?? p.name })
    put('mainImage', { type: 'string', value: mainImage })

    otherImages.slice(0, 8).forEach((imgUrl, idx) => {
      const key = `image_${idx + 2}`
      const col = keyToCol.get(key)
      if (col) cells[col] = { type: 'string', value: imgUrl }
    })

    if (p.barcode) {
      put('gtinType', { type: 'string', value: 'UPC' })
      put('gtinCode', { type: 'string', value: p.barcode })
    }

    put('parcelWeight', { type: 'number', value: Number(weightLb.toFixed(2)) })
    put('parcelLength', {
      type: 'number',
      value: dims.length ?? DEFAULT_PARCEL_LENGTH_IN,
    })
    put('parcelWidth', {
      type: 'number',
      value: dims.width ?? DEFAULT_PARCEL_WIDTH_IN,
    })
    put('parcelHeight', {
      type: 'number',
      value: dims.height ?? DEFAULT_PARCEL_HEIGHT_IN,
    })
    put('price', { type: 'number', value: Number(p.price) })
    put('quantity', { type: 'number', value: p.inventory })
    put('sellerSku', { type: 'string', value: p.sku })
    put('regionOfOrigin', { type: 'string', value: REGION_OF_ORIGIN })
    put('ingredients', { type: 'string', value: p.ingredients.join(', ') })
    put('ageWarning', { type: 'string', value: AGE_WARNING })
    put('manufacturer', { type: 'string', value: MANUFACTURER })
    put('storageTemperature', { type: 'string', value: STORAGE_TEMPERATURE })

    const sortedLetters = Object.keys(cells).sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length
      return a < b ? -1 : a > b ? 1 : 0
    })
    const cellsXml = sortedLetters
      .map((col) => cellXml(`${col}${rowNum}`, cells[col]))
      .join('')
    return `<row r="${rowNum}">${cellsXml}</row>`
  }

  /**
   * Load the template fresh from the buffer, inject the given chunk's rows,
   * and write to disk. Loading from the buffer (not the original zip object)
   * ensures each chunk gets an independent xlsx with no shared mutation.
   */
  async function writeChunk(
    chunk: Product[],
    outFilename: string,
  ): Promise<void> {
    const chunkZip = await JSZip.loadAsync(templateBuf)
    const chunkSheet = chunkZip.file('xl/worksheets/sheet1.xml')
    if (!chunkSheet) throw new Error('sheet1.xml missing in template buffer')
    const chunkXml = await chunkSheet.async('string')

    const dataRows = chunk.map((p, i) => buildRowXml(p, DATA_START_ROW + i))

    // Strip example/data rows at row 6+ (preserves header + instruction rows).
    const stripPattern = /<row[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g
    const stripped = chunkXml.replace(stripPattern, (match, rowNum) =>
      Number(rowNum) >= DATA_START_ROW ? '' : match,
    )
    const finalXml = stripped.replace(
      /<\/sheetData>/,
      `${dataRows.join('')}</sheetData>`,
    )

    chunkZip.file('xl/worksheets/sheet1.xml', finalXml)
    const outBuf = await chunkZip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })
    const outPath = resolve(process.cwd(), outFilename)
    await writeFile(outPath, outBuf)
    console.log(`Wrote ${chunk.length} products to ${outPath}`)
  }

  if (!CHUNK_SIZE) {
    await writeChunk(products, OUTPUT_FILENAME)
    return
  }

  // Split into N files of at most CHUNK_SIZE products each.
  const chunks: Product[][] = []
  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    chunks.push(products.slice(i, i + CHUNK_SIZE))
  }
  const stem = OUTPUT_FILENAME.replace(/\.xlsx$/, '')
  for (let idx = 0; idx < chunks.length; idx++) {
    await writeChunk(chunks[idx], `${stem}-${idx + 1}.xlsx`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
