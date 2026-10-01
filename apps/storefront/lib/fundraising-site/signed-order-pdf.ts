import 'server-only'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { toPdfSafeText } from '@/lib/waivers/promoRelease'
import {
  DUE_PER_JAR,
  ORDER_KITS,
  PAYMENT_METHODS,
  PRICE_PER_JAR,
  summarizeOrder,
  type OrderSubmission,
} from '@/lib/fundraising-site/order-submission'

/** Vercel Blob folder holding signed final-order PDFs. */
export const SIGNED_ORDER_BLOB_DIRECTORY = 'fundraising/order-submissions'

/** The statement the box on /submit confirms, printed beside the signature. */
export const CONFIRM_FINAL_TEXT =
  'This order is 100% final. Every tracking sheet is in, and the jar counts and money match. We will fill the order exactly as entered.'

export type SignedOrderMeta = { submittedAt: Date; reference: string | null; ipAddress: string | null }

function easternDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'long' }).format(date)
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

/** e.g. fundraising/order-submissions/2026/10/2026-10-01-lincoln-pto.pdf (Blob adds a random suffix). */
export function signedOrderPathname(order: Pick<OrderSubmission, 'organizationName'>, submittedAt: Date): string {
  const date = easternDate(submittedAt)
  const [year, month] = date.split('-')
  return `${SIGNED_ORDER_BLOB_DIRECTORY}/${year}/${month}/${date}-${slugify(order.organizationName)}.pdf`
}

const INK = rgb(0.11, 0.1, 0.09)
const MUTED = rgb(0.42, 0.4, 0.38)
const SALSA = rgb(0.725, 0.11, 0.11)
const money = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

/** The signed order as a Letter PDF: contact, ship-to, every kit flavor, totals, confirmation and signature. */
export async function buildSignedOrderPdf(order: OrderSubmission, meta: SignedOrderMeta): Promise<Uint8Array> {
  const summary = summarizeOrder(order.kit, order.quantities)
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Final Fundraiser Order - ${toPdfSafeText(order.organizationName)}`)
  pdf.setAuthor('Jose Madrid Salsa')
  pdf.setCreationDate(meta.submittedAt)

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const margin = 48
  let page: PDFPage = pdf.addPage([612, 792])
  const width = page.getWidth() - margin * 2
  let y = page.getHeight() - margin

  const ensureRoom = (height: number) => {
    if (y - height < margin) {
      page = pdf.addPage([612, 792])
      y = page.getHeight() - margin
    }
  }
  const draw = (value: string, x: number, options: { font?: PDFFont; size?: number; color?: typeof INK; right?: boolean } = {}) => {
    const font = options.font ?? regular
    const size = options.size ?? 10
    const safe = toPdfSafeText(value)
    const left = options.right ? x - font.widthOfTextAtSize(safe, size) : x
    page.drawText(safe, { x: left, y: y - size, size, font, color: options.color ?? INK })
  }
  const paragraph = (value: string, size: number) => {
    let line = ''
    const lines: string[] = []
    for (const word of toPdfSafeText(value).split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (regular.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    for (const entry of lines) {
      ensureRoom(size * 1.45)
      draw(entry, margin, { size })
      y -= size * 1.45
    }
  }

  draw('JOSE MADRID SALSA', margin, { font: bold, size: 10, color: SALSA })
  if (meta.reference) draw(`Ref ${meta.reference}`, margin + width, { font: bold, size: 11, right: true })
  y -= 16
  draw('Final Fundraiser Order', margin, { font: bold, size: 22 })
  y -= 28
  draw(`Submitted ${formatTimestamp(meta.submittedAt)} - ${ORDER_KITS[order.kit].label}`, margin, { size: 9, color: MUTED })
  y -= 22

  const columnX = margin + width / 2 + 8
  const top = y
  for (const [label, value] of [
    ['Organization', order.organizationName],
    ['Submitted by', order.contactName],
    ['Email / phone', `${order.email} - ${order.phone}`],
    ['Payment', PAYMENT_METHODS[order.paymentMethod]],
  ] as const) {
    draw(label.toUpperCase(), margin, { font: bold, size: 7.5, color: MUTED })
    y -= 10
    draw(value, margin, { size: 10.5 })
    y -= 17
  }
  const leftEnd = y
  y = top
  draw('SHIP TO', columnX, { font: bold, size: 7.5, color: MUTED })
  y -= 10
  for (const line of [order.shipName, order.shipStreet, `${order.shipCity}, ${order.shipState} ${order.shipZip}`]) {
    draw(line, columnX, { size: 10.5 })
    y -= 14
  }
  y = Math.min(leftEnd, y) - 6

  const qtyRight = margin + width - 110
  const amountRight = margin + width
  page.drawLine({ start: { x: margin, y }, end: { x: amountRight, y }, thickness: 1, color: INK })
  y -= 6
  draw('FLAVOR', margin, { font: bold, size: 8 })
  draw('JARS', qtyRight, { font: bold, size: 8, right: true })
  draw(`@ ${money(PRICE_PER_JAR)}`, amountRight, { font: bold, size: 8, right: true })
  y -= 14
  for (const flavor of ORDER_KITS[order.kit].flavors) {
    const jars = order.quantities[flavor.id] ?? 0
    ensureRoom(14)
    const font = jars ? bold : regular
    draw(flavor.name, margin, { font, size: 9.5 })
    draw(String(jars), qtyRight, { font, size: 9.5, right: true })
    draw(jars ? money(jars * PRICE_PER_JAR) : '-', amountRight, { font, size: 9.5, right: true })
    y -= 13.5
  }
  ensureRoom(70)
  page.drawLine({ start: { x: margin, y }, end: { x: amountRight, y }, thickness: 1, color: INK })
  y -= 8
  for (const [label, value, strong] of [
    ['Total jars', String(summary.totalJars), true],
    ['Sales value', money(summary.salesValue), false],
    [`Amount due to Jose Madrid Salsa (@ ${money(DUE_PER_JAR)}/jar)`, money(summary.amountDue), true],
    ['Group keeps', money(summary.groupKeeps), false],
  ] as const) {
    draw(label, margin, { font: strong ? bold : regular, size: 11 })
    draw(value, amountRight, { font: strong ? bold : regular, size: 11, right: true })
    y -= 15
  }
  y -= 6
  if (order.notes) {
    draw('NOTES', margin, { font: bold, size: 7.5, color: MUTED })
    y -= 11
    paragraph(order.notes, 9.5)
    y -= 6
  }

  // Confirmation and signature always share a page.
  ensureRoom(190)
  draw('CONFIRMED', margin, { font: bold, size: 7.5, color: MUTED })
  y -= 11
  paragraph(`[X] ${CONFIRM_FINAL_TEXT}`, 9.5)
  y -= 8
  // pdf-lib takes the data URL as-is.
  const png = await pdf.embedPng(order.signature)
  const scale = Math.min(260 / png.width, 70 / png.height)
  page.drawImage(png, { x: margin, y: y - png.height * scale, width: png.width * scale, height: png.height * scale })
  y -= 74
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 280, y }, thickness: 0.75, color: INK })
  y -= 4
  draw(`Signed electronically by ${order.contactName}`, margin, { size: 9 })
  y -= 13
  draw(`${formatTimestamp(meta.submittedAt)} - IP ${meta.ipAddress ?? 'unknown'}`, margin, { size: 8, color: MUTED })

  return pdf.save()
}
