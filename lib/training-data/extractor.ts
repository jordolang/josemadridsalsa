import crypto from 'crypto'
import path from 'path'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import JSZip from 'jszip'
import { load as loadHtml } from 'cheerio'
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  TRAINING_MAX_CHARACTERS,
} from './constants'

export type ExtractionStatus = 'ready' | 'needs_review' | 'unsupported' | 'failed'

export type ExtractionResult = {
  text: string | null
  title?: string | null
  warnings: string[]
  status: ExtractionStatus
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer)
  return result.text ?? ''
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
      text = stringifyWorkbook(buffer)
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
  } catch (error: any) {
    status = 'failed'
    warnings.push(`Extraction failed: ${error.message}`)
    text = null
  }

  return {
    text: text?.trim().length ? text : null,
    title: fileName ? stripExtension(fileName) : null,
    warnings,
    status: text ? status : 'failed',
  }
}

export async function extractTextFromUrl(url: string): Promise<ExtractionResult> {
  const warnings: string[] = []

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'JoseMadridSalsaBot/1.0 (+https://josemadridsalsa.com)',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        text: null,
        warnings: [`Unable to load URL (${response.status})`],
        status: 'failed',
      }
    }

    const contentType = response.headers.get('content-type') ?? ''
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

    // Fallback to plain text
    const text = await response.text()
    return {
      text,
      warnings: [
        ...warnings,
        contentType
          ? `Treated content-type "${contentType}" as plain text.`
          : 'Unable to detect content-type; stored as plain text.',
      ],
      status: text.trim() ? 'ready' : 'needs_review',
    }
  } catch (error: any) {
    return {
      text: null,
      warnings: [`Failed to scrape URL: ${error.message}`],
      status: 'failed',
    }
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

function stringifyWorkbook(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheets = workbook.SheetNames
  if (sheets.length === 0) return ''

  const parts = sheets.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    return `Sheet: ${sheetName}\n${csv.trim()}`
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
  const $ = loadHtml(html)
  $('script, style, noscript').remove()
  const text = $('body').text()
  return text.replace(/\s+/g, ' ').trim()
}

function extractHtmlTitle(html: string): string | null {
  const $ = loadHtml(html)
  const title = $('title').first().text().trim()
  return title || null
}
