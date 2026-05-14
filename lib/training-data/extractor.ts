import crypto from 'crypto'
import path from 'path'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import { load as loadHtml } from 'cheerio'
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  TRAINING_MAX_CHARACTERS,
} from './constants'
import { getErrorMessage } from '@/lib/errors'

const FETCH_TIMEOUT_MS = 15_000
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:'])

export type ExtractionStatus = 'ready' | 'needs_review' | 'unsupported' | 'failed'

export type ExtractionResult = {
  text: string | null
  title?: string | null
  warnings: string[]
  status: ExtractionStatus
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import for pdf-parse to avoid ESM issues
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buffer)
    return result.text ?? ''
  } catch (error) {
    // PDF parsing failed, return empty string
    return ''
  }
}

export function normalizeTrainingText(raw: string): {
  content: string
  truncated: boolean
} {
  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (normalized.length <= TRAINING_MAX_CHARACTERS) {
    return { content: normalized, truncated: false }
  }

  return {
    content: normalized.slice(0, TRAINING_MAX_CHARACTERS),
    truncated: true,
  }
}

export function buildContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function extractTextFromUpload({
  buffer,
  fileName,
  mimeType,
}: {
  buffer: Buffer
  fileName?: string | null
  mimeType?: string | null
}): Promise<ExtractionResult> {
  const warnings: string[] = []
  let text: string | null = null
  let status: ExtractionStatus = 'ready'
  const extension = (fileName ? path.extname(fileName).toLowerCase() : '') || ''

  const isMime = (value: string) => {
    return mimeType?.toLowerCase().includes(value.toLowerCase())
  }

  try {
    if (isPlainTextMime(mimeType) || isPlainTextExtension(extension)) {
      text = buffer.toString('utf-8')
    } else if (extension === '.csv' || extension === '.tsv' || isMime('csv')) {
      text = stringifyCsv(buffer.toString('utf-8'), extension === '.tsv')
    } else if (
      extension === '.xlsx' ||
      extension === '.xls' ||
      isMime('spreadsheetml') ||
      isMime('ms-excel')
    ) {
      text = await stringifyWorkbook(buffer)
    } else if (
      extension === '.docx' ||
      extension === '.doc' ||
      isMime('wordprocessingml') ||
      isMime('msword')
    ) {
      const mammothResult = await mammoth.extractRawText({ buffer })
      text = mammothResult.value
      if (mammothResult.messages.length > 0) {
        warnings.push(
          ...mammothResult.messages.map((message) => `DOCX: ${message.message}`),
        )
      }
    } else if (extension === '.pdf' || isMime('pdf')) {
      const pdfText = await extractPdfText(buffer)
      text = pdfText
      if (!pdfText.trim()) {
        status = 'needs_review'
        warnings.push('PDF did not contain extractable text (possibly scanned).')
      }
    } else if (extension === '.rtf' || isMime('rtf')) {
      text = stripRtf(buffer.toString('utf-8'))
    } else if (extension === '.epub' || isMime('epub')) {
      text = await extractEpub(buffer)
    } else if (extension === '.json' || mimeType === 'application/json') {
      text = buffer.toString('utf-8')
    } else if (extension === '.html' || extension === '.htm' || isMime('html')) {
      text = htmlToText(buffer.toString('utf-8'))
    } else if (mimeType?.startsWith('image/')) {
      status = 'unsupported'
      warnings.push('Image ingestion requires OCR which is not available yet.')
    } else {
      // Default to UTF-8 text extraction but flag for review
      text = buffer.toString('utf-8')
      status = 'needs_review'
      warnings.push('File type not fully supported. Stored raw text as a fallback.')
    }
  } catch (error: unknown) {
    status = 'failed'
    warnings.push(`Extraction failed: ${getErrorMessage(error)}`)
    text = null
  }

  const trimmed = text?.trim() ?? ''
  const normalizedText = trimmed.length ? trimmed : null
  const finalStatus: ExtractionStatus = normalizedText
    ? status
    : status === 'unsupported'
      ? 'unsupported'
      : status === 'needs_review'
        ? 'needs_review'
        : 'failed'

  return {
    text: normalizedText,
    title: fileName ? stripExtension(fileName) : null,
    warnings,
    status: finalStatus,
  }
}

export async function extractTextFromUrl(rawUrl: string): Promise<ExtractionResult> {
  const warnings: string[] = []
  let parsed: URL

  try {
    parsed = new URL(rawUrl)
  } catch {
    return {
      text: null,
      warnings: ['Invalid URL provided.'],
      status: 'failed',
    }
  }

  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    return {
      text: null,
      warnings: ['Only HTTP and HTTPS URLs are supported.'],
      status: 'failed',
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        Accept: 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': 'JoseMadridSalsaBot/1.0 (+https://josemadridsalsa.com)',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        text: null,
        warnings: [`Unable to load URL (${response.status}).`],
        status: 'failed',
      }
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()

    if (contentType.includes('text/html')) {
      const html = await response.text()
      const text = htmlToText(html)
      const title = extractHtmlTitle(html)
      return {
        text,
        title,
        warnings,
        status: text ? 'ready' : 'needs_review',
      }
    }

    if (contentType.includes('application/pdf')) {
      const arrayBuffer = await response.arrayBuffer()
      const pdfText = await extractPdfText(Buffer.from(arrayBuffer))
      return {
        text: pdfText,
        title: null,
        warnings,
        status: pdfText.trim() ? 'ready' : 'needs_review',
      }
    }

    const text = await response.text()
    if (contentType) {
      warnings.push(`Treated content-type "${contentType}" as plain text.`)
    } else {
      warnings.push('Unable to detect content-type; stored as plain text.')
    }

    return {
      text,
      warnings,
      status: text.trim() ? 'ready' : 'needs_review',
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      warnings.push(`Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`)
    } else {
      warnings.push(`Failed to scrape URL: ${getErrorMessage(error)}`)
    }

    return {
      text: null,
      warnings,
      status: 'failed',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function isPlainTextExtension(ext: string) {
  return ['.txt', '.md', '.markdown', '.mdx', '.json', '.yml', '.yaml'].includes(ext)
}

function isPlainTextMime(mime?: string | null) {
  if (!mime) return false
  return (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('javascript')
  )
}

function stripExtension(name: string): string {
  const base = path.basename(name)
  const idx = base.lastIndexOf('.')
  return idx === -1 ? base : base.slice(0, idx)
}

function stringifyCsv(raw: string, tabSeparated = false): string {
  const parsed = Papa.parse<string[]>(raw, {
    delimiter: tabSeparated ? '\t' : undefined,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    return raw
  }

  const rows = parsed.data as string[][]
  return rows
    .map((row) =>
      row
        .map((cell) => (typeof cell === 'string' ? cell.trim() : cell ?? ''))
        .join(' | '),
    )
    .join('\n')
}

async function stringifyWorkbook(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)
  
  if (workbook.worksheets.length === 0) return ''

  const parts = workbook.worksheets.map((sheet) => {
    const rows: string[] = []
    sheet.eachRow((row) => {
      const cells: string[] = []
      row.eachCell((cell) => {
        cells.push(cell.value?.toString() || '')
      })
      if (cells.some(c => c)) { // Skip blank rows
        rows.push(cells.join(','))
      }
    })
    return `Sheet: ${sheet.name}\n${rows.join('\n')}`
  })

  return parts.join('\n\n')
}

function stripRtf(raw: string): string {
  return raw
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\[a-z]+\d*/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

async function extractEpub(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const htmlFiles = Object.keys(zip.files).filter((file) =>
    /\.x?html$/i.test(file),
  )

  if (htmlFiles.length === 0) {
    return ''
  }

  const parts: string[] = []
  for (const fileName of htmlFiles) {
    const file = zip.file(fileName)
    if (!file) continue
    const html = await file.async('text')
    const text = htmlToText(html)
    parts.push(`Section: ${path.basename(fileName)}\n${text}`)
  }

  return parts.join('\n\n')
}

function htmlToText(html: string): string {
  const normalizedHtml = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, '\n')

  const $ = loadHtml(normalizedHtml)
  $('script, style, noscript').remove()
  const text = $('body').text()
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function extractHtmlTitle(html: string): string | null {
  const $ = loadHtml(html)
  const title = $('title').first().text().trim()
  return title || null
}
