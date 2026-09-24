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

export const promoReleaseSubmissionSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Please enter your full name').max(100),
    email: z
      .union([z.literal(''), z.string().trim().toLowerCase().email('Please enter a valid email').max(200)])
      .optional()
      .transform((value) => (value ? value : undefined)),
    decision: z.enum(PROMO_RELEASE_DECISIONS),
    signingForMinor: z.boolean().default(false),
    minorName: optionalText(100),
    event: optionalText(80),
  })
  .superRefine((data, ctx) => {
    if (data.signingForMinor && (!data.minorName || data.minorName.length < 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['minorName'],
        message: "Please enter the child's full name",
      })
    }
  })
  .transform((data) => ({
    ...data,
    minorName: data.signingForMinor ? data.minorName : undefined,
  }))

export type PromoReleaseSubmission = z.infer<typeof promoReleaseSubmissionSchema>

export interface PromoReleaseRecord extends PromoReleaseSubmission {
  id: string
  version: string
  submittedAt: string
  collectedBy: string
  ipAddress: string | null
  userAgent: string | null
}

export function createPromoReleaseRecord(
  submission: PromoReleaseSubmission,
  context: {
    collectedBy: string
    ipAddress?: string | null
    userAgent?: string | null
    now?: Date
    id?: string
  },
): PromoReleaseRecord {
  return {
    ...submission,
    id: context.id ?? globalThis.crypto.randomUUID(),
    version: PROMO_RELEASE_VERSION,
    submittedAt: (context.now ?? new Date()).toISOString(),
    collectedBy: context.collectedBy,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'unnamed'
  )
}

/** Eastern-time date parts, so folders match the day the waiver was signed at the booth. */
function easternDateParts(iso: string): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * Blob pathname (without extension) for a record, e.g.
 * waivers/promotional-release/2026/09/2026-09-24-agree-maria-lopez-1a2b3c4d
 */
export function buildPromoReleasePathname(record: PromoReleaseRecord): string {
  const { year, month, day } = easternDateParts(record.submittedAt)
  const shortId = record.id.replace(/-/g, '').slice(0, 8)
  return `${PROMO_RELEASE_BLOB_DIRECTORY}/${year}/${month}/${year}-${month}-${day}-${record.decision}-${slugify(record.fullName)}-${shortId}`
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
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, '?')
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
  pdf.setTitle(`${PROMO_RELEASE_TITLE} - ${toPdfSafeText(record.fullName)}`)
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
    ['Name', record.fullName],
    ['Email', record.email ?? 'Not provided'],
  ]
  if (record.signingForMinor) {
    fields.push(['Signing for minor', record.minorName ?? ''])
    fields.push(['Relationship', 'Parent or legal guardian (confirmed)'])
  }
  fields.push(['Event', record.event ?? 'Not specified'])
  fields.push(['Signed', formatPromoReleaseTimestamp(record.submittedAt)])

  for (const [label, value] of fields) {
    ensureRoom(16)
    page.drawText(toPdfSafeText(label), { x: margin, y: y - 10.5, size: 10.5, font: bold, color: MUTED })
    const valueLines = wrapText(value, regular, 10.5, width - 130)
    valueLines.forEach((line, index) => {
      page.drawText(line, { x: margin + 130, y: y - 10.5 - index * 15, size: 10.5, font: regular, color: INK })
    })
    y -= Math.max(1, valueLines.length) * 15 + 4
  }

  y -= 12
  write('Release terms shown to the signer', { font: bold, size: 12, gap: 4 })
  write(PROMO_RELEASE_INTRO, { gap: 6 })
  PROMO_RELEASE_TERMS.forEach((term, index) => {
    write(`${index + 1}.  ${term}`, { indent: 0, gap: 4 })
  })

  y -= 12
  write(
    `By tapping "${agreed ? 'Yes, feature me' : "No, please don't"}" and Submit on the Jose Madrid Salsa waiver kiosk, the signer made this election electronically.`,
    { size: 9.5, color: MUTED, gap: 10 },
  )

  write('Audit record', { font: bold, size: 10, color: MUTED, gap: 2 })
  write(`Record ID: ${record.id}`, { size: 8.5, color: MUTED })
  write(`Submitted (UTC): ${record.submittedAt}`, { size: 8.5, color: MUTED })
  write(`Collected by: ${record.collectedBy}`, { size: 8.5, color: MUTED })
  write(`IP address: ${record.ipAddress ?? 'unknown'}`, { size: 8.5, color: MUTED })
  write(`Device: ${record.userAgent ?? 'unknown'}`, { size: 8.5, color: MUTED })

  return pdf.save()
}
