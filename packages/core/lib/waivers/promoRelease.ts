import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { z } from 'zod'
import {
  PROMO_RELEASE_BLOB_DIRECTORY,
  PROMO_RELEASE_DECISIONS,
  PROMO_RELEASE_INTRO,
  PROMO_RELEASE_TERMS,
  PROMO_RELEASE_TITLE,
  PROMO_RELEASE_VERSION,
} from '@/lib/waivers/promoReleaseCopy'

export * from '@/lib/waivers/promoReleaseCopy'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

/** Largest drawn signature we accept, as a base64 PNG data URL (~375 KB of image). */
export const PROMO_RELEASE_SIGNATURE_MAX_LENGTH = 500_000
const SIGNATURE_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/

export const promoReleaseSubmissionSchema = z
  .object({
    fullName: optionalText(100).refine((value) => !value || value.length >= 2, 'Please enter your full name'),
    email: z
      .union([z.literal(''), z.string().trim().toLowerCase().email('Please enter a valid email').max(200)])
      .optional()
      .transform((value) => (value ? value : undefined)),
    decision: z.enum(PROMO_RELEASE_DECISIONS),
    signature: z
      .string()
      .max(PROMO_RELEASE_SIGNATURE_MAX_LENGTH, 'Signature is too large')
      .regex(SIGNATURE_DATA_URL, 'Signature must be a PNG image')
      .optional(),
    signingForMinor: z.boolean().default(false),
    minorName: optionalText(100),
    event: optionalText(80),
    /** The iPad's own clock when Submit was tapped, kept beside the server time for footage sync. */
    clientSubmittedAt: z.iso.datetime().optional(),
    /** GPS fix from the iPad, when location permission was granted. */
    location: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracyMeters: z.number().min(0).max(100_000),
        capturedAt: z.iso.datetime(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'agree' && !data.signature) {
      ctx.addIssue({ code: 'custom', path: ['signature'], message: 'Please sign to agree' })
    }
  })
  .transform((data) => ({
    ...data,
    // A decline needs no signature; never keep one that came along anyway.
    signature: data.decision === 'agree' ? data.signature : undefined,
    minorName: data.signingForMinor ? data.minorName : undefined,
  }))

export type PromoReleaseSubmission = z.infer<typeof promoReleaseSubmissionSchema>

export interface PromoReleaseNetworkLocation {
  city: string | null
  region: string | null
  country: string | null
}

export interface PromoReleaseRecord extends PromoReleaseSubmission {
  id: string
  /** Short code shown on the thank-you screen, so a camera can film it as a sync marker. */
  code: string
  version: string
  submittedAt: string
  collectedBy: string
  ipAddress: string | null
  userAgent: string | null
  /** Approximate place from the request's IP (Vercel geo headers); a fallback when GPS is off. */
  networkLocation: PromoReleaseNetworkLocation | null
}

/** What the JSON log file holds: the record minus the signature image, plus where its PDF lives. */
export type PromoReleaseLogEntry = Omit<PromoReleaseRecord, 'signature'> & {
  signed: boolean
  pdfUrl: string | null
}

export function promoReleaseCode(id: string): string {
  return `JM-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

function readHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function networkLocationFromHeaders(headers: Headers): PromoReleaseNetworkLocation | null {
  const location = {
    city: readHeader(headers, 'x-vercel-ip-city'),
    region: readHeader(headers, 'x-vercel-ip-country-region'),
    country: readHeader(headers, 'x-vercel-ip-country'),
  }
  return location.city || location.region || location.country ? location : null
}

export function toPromoReleaseLogEntry(record: PromoReleaseRecord, pdfUrl: string | null): PromoReleaseLogEntry {
  const { signature, ...rest } = record
  return { ...rest, signed: Boolean(signature), pdfUrl }
}

export function createPromoReleaseRecord(
  submission: PromoReleaseSubmission,
  context: {
    collectedBy: string
    ipAddress?: string | null
    userAgent?: string | null
    networkLocation?: PromoReleaseNetworkLocation | null
    now?: Date
    id?: string
  },
): PromoReleaseRecord {
  const id = context.id ?? globalThis.crypto.randomUUID()
  return {
    ...submission,
    id,
    code: promoReleaseCode(id),
    version: PROMO_RELEASE_VERSION,
    submittedAt: (context.now ?? new Date()).toISOString(),
    collectedBy: context.collectedBy,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
    networkLocation: context.networkLocation ?? null,
  }
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'unnamed'
  )
}

/** Eastern-time parts, so folders and file names match the booth's wall clock. */
function easternParts(iso: string): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** YYYY-MM-DD in Eastern time. */
export function easternDateKey(iso: string): string {
  const { year, month, day } = easternParts(iso)
  return `${year}-${month}-${day}`
}

/** Blob prefix holding every record signed on an Eastern-time day (YYYY-MM-DD). */
export function promoReleaseDayPrefix(dateKey: string): string {
  const [year, month] = dateKey.split('-')
  return `${PROMO_RELEASE_BLOB_DIRECTORY}/${year}/${month}/${dateKey}-`
}

/**
 * Blob pathname (without extension) for a record. The Eastern time to the second
 * leads, so a day's folder sorts in the order people signed, e.g.
 * waivers/promotional-release/2026/09/2026-09-24-133012-agree-anonymous-jm-1a2b3c
 */
export function buildPromoReleasePathname(record: PromoReleaseRecord): string {
  const { year, month, day, hour, minute, second } = easternParts(record.submittedAt)
  const name = record.fullName ? slugify(record.fullName) : 'anonymous'
  return `${PROMO_RELEASE_BLOB_DIRECTORY}/${year}/${month}/${year}-${month}-${day}-${hour}${minute}${second}-${record.decision}-${name}-${record.code.toLowerCase()}`
}

/** Wall-clock time to the second in Eastern time, e.g. "1:30:12 PM". */
export function formatPromoReleaseClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso))
}

export function formatPromoReleaseLocation(record: Pick<PromoReleaseRecord, 'location' | 'networkLocation'>): string {
  if (record.location) {
    const { latitude, longitude, accuracyMeters } = record.location
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracyMeters)} m, GPS)`
  }
  const network = record.networkLocation
  const place = network ? [network.city, network.region, network.country].filter(Boolean).join(', ') : ''
  return place ? `${place} (approximate, from network)` : 'Not available'
}

export function promoReleaseMapUrl(record: Pick<PromoReleaseRecord, 'location'>): string | null {
  return record.location
    ? `https://maps.google.com/?q=${record.location.latitude},${record.location.longitude}`
    : null
}

const CSV_COLUMNS = [
  'time_eastern',
  'submitted_utc',
  'device_time_utc',
  'code',
  'decision',
  'signed',
  'name',
  'email',
  'minor',
  'minor_name',
  'event',
  'latitude',
  'longitude',
  'accuracy_m',
  'network_location',
  'collected_by',
  'pdf_url',
  'record_id',
] as const

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  // Typed text starting with =, +, -, @ would run as a formula in Excel/Sheets; numbers are safe.
  const safe = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** One row per waiver, oldest first, for lining up against footage timestamps. */
export function buildPromoReleaseCsv(entries: PromoReleaseLogEntry[]): string {
  const rows = [...entries]
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((entry) => {
      const network = entry.networkLocation
      return [
        formatPromoReleaseClock(entry.submittedAt),
        entry.submittedAt,
        entry.clientSubmittedAt,
        entry.code,
        entry.decision,
        entry.signed,
        entry.fullName,
        entry.email,
        entry.signingForMinor,
        entry.minorName,
        entry.event,
        entry.location?.latitude,
        entry.location?.longitude,
        entry.location ? Math.round(entry.location.accuracyMeters) : null,
        network ? [network.city, network.region, network.country].filter(Boolean).join(', ') : null,
        entry.collectedBy,
        entry.pdfUrl,
        entry.id,
      ]
        .map(csvCell)
        .join(',')
    })
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}

export function formatPromoReleaseTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'long',
  }).format(new Date(iso))
}

/** pdf-lib's standard fonts only encode WinAnsi; swap anything else for '?' instead of throwing. */
export function toPdfSafeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022]/g, '?')
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of toPdfSafeText(text).split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

const INK = rgb(0.11, 0.1, 0.09)
const MUTED = rgb(0.42, 0.4, 0.38)
const SALSA = rgb(0.725, 0.11, 0.11)
const VERDE = rgb(0.086, 0.396, 0.204)

/** Renders the signed record as a one-page Letter PDF for the Blob archive. */
export async function buildPromoReleasePdf(record: PromoReleaseRecord): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${PROMO_RELEASE_TITLE} - ${toPdfSafeText(record.fullName ?? 'Anonymous')}`)
  pdf.setAuthor('Jose Madrid Salsa')
  pdf.setSubject(`Promotional release ${record.id}`)
  pdf.setCreationDate(new Date(record.submittedAt))

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const margin = 56
  let page: PDFPage = pdf.addPage([612, 792])
  const width = page.getWidth() - margin * 2
  let y = page.getHeight() - margin

  const ensureRoom = (height: number) => {
    if (y - height < margin) {
      page = pdf.addPage([612, 792])
      y = page.getHeight() - margin
    }
  }

  const write = (text: string, options: { font?: PDFFont; size?: number; color?: typeof INK; gap?: number; indent?: number } = {}) => {
    const font = options.font ?? regular
    const size = options.size ?? 10.5
    const indent = options.indent ?? 0
    for (const line of wrapText(text, font, size, width - indent)) {
      ensureRoom(size * 1.45)
      page.drawText(line, { x: margin + indent, y: y - size, size, font, color: options.color ?? INK })
      y -= size * 1.45
    }
    y -= options.gap ?? 0
  }

  write('JOSE MADRID SALSA', { font: bold, size: 10, color: SALSA, gap: 2 })
  write(PROMO_RELEASE_TITLE, { font: bold, size: 22, gap: 4 })
  write(`Form version ${record.version}`, { size: 9, color: MUTED, gap: 14 })

  const agreed = record.decision === 'agree'
  const boxHeight = 44
  ensureRoom(boxHeight + 16)
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width,
    height: boxHeight,
    borderColor: agreed ? VERDE : SALSA,
    borderWidth: 1.5,
    color: agreed ? rgb(0.94, 0.99, 0.96) : rgb(1, 0.95, 0.95),
  })
  page.drawText(agreed ? 'AGREED - may be featured' : 'DECLINED - do not feature', {
    x: margin + 16,
    y: y - boxHeight / 2 - 6,
    size: 16,
    font: bold,
    color: agreed ? VERDE : SALSA,
  })
  y -= boxHeight + 20

  const fields: Array<[string, string]> = [
    ['Name', record.fullName ?? 'Not provided (anonymous)'],
    ['Email', record.email ?? 'Not provided'],
  ]
  if (record.signingForMinor) {
    fields.push(['Signing for minor', record.minorName ?? 'Name not provided'])
    fields.push(['Relationship', 'Parent or legal guardian (confirmed)'])
  }
  fields.push(['Event', record.event ?? 'Not specified'])
  fields.push(['Signed', formatPromoReleaseTimestamp(record.submittedAt)])
  fields.push(['Record code', record.code])
  fields.push(['Location', formatPromoReleaseLocation(record)])

  for (const [label, value] of fields) {
    ensureRoom(16)
    page.drawText(toPdfSafeText(label), { x: margin, y: y - 10.5, size: 10.5, font: bold, color: MUTED })
    const valueLines = wrapText(value, regular, 10.5, width - 130)
    valueLines.forEach((line, index) => {
      page.drawText(line, { x: margin + 130, y: y - 10.5 - index * 15, size: 10.5, font: regular, color: INK })
    })
    y -= Math.max(1, valueLines.length) * 15 + 4
  }

  if (record.signature) {
    const image = await pdf.embedPng(record.signature)
    const maxWidth = 260
    const maxHeight = 90
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
    const drawn = { width: image.width * scale, height: image.height * scale }
    ensureRoom(maxHeight + 40)
    y -= 8
    page.drawText('Signature', { x: margin, y: y - 10.5, size: 10.5, font: bold, color: MUTED })
    page.drawImage(image, { x: margin + 130, y: y - drawn.height, width: drawn.width, height: drawn.height })
    y -= drawn.height + 6
    page.drawLine({
      start: { x: margin + 130, y },
      end: { x: margin + 130 + maxWidth, y },
      thickness: 0.75,
      color: MUTED,
    })
    y -= 10
  }

  y -= 12
  write('Release terms shown to the signer', { font: bold, size: 12, gap: 4 })
  write(PROMO_RELEASE_INTRO, { gap: 6 })
  PROMO_RELEASE_TERMS.forEach((term, index) => {
    write(`${index + 1}.  ${term}`, { indent: 0, gap: 4 })
  })

  y -= 12
  write(
    agreed
      ? 'The signer tapped "Yes, feature me", drew the signature above, and tapped Submit on the Jose Madrid Salsa waiver kiosk.'
      : 'The signer tapped "No, please don\'t" and Submit on the Jose Madrid Salsa waiver kiosk.',
    { size: 9.5, color: MUTED, gap: 10 },
  )

  write('Audit record', { font: bold, size: 10, color: MUTED, gap: 2 })
  write(`Record ID: ${record.id}`, { size: 8.5, color: MUTED })
  write(`Submitted (UTC, server): ${record.submittedAt}`, { size: 8.5, color: MUTED })
  write(`Submitted (UTC, iPad clock): ${record.clientSubmittedAt ?? 'unknown'}`, { size: 8.5, color: MUTED })
  if (record.location) {
    write(`GPS fix taken (UTC): ${record.location.capturedAt}`, { size: 8.5, color: MUTED })
  }
  write(`Collected by: ${record.collectedBy}`, { size: 8.5, color: MUTED })
  write(`IP address: ${record.ipAddress ?? 'unknown'}`, { size: 8.5, color: MUTED })
  write(`Device: ${record.userAgent ?? 'unknown'}`, { size: 8.5, color: MUTED })

  return pdf.save()
}
