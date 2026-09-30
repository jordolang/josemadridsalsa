import 'server-only'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { toPdfSafeText } from '@/lib/waivers/promoRelease'
import {
  ORDER_FORM_CATEGORIES,
  ORDER_FORM_DUE_CENTS,
  ORDER_FORM_FREE_SHIPPING_JARS,
  ORDER_FORM_RETAIL_CENTS,
  computeOrderFormTotals,
  formatOrderFormCents,
  orderFormAgreementText,
  orderFormFlavorLabel,
  type OrderFormSubmission,
  type OrderFormTotals,
} from '@/lib/fundraising-site/order-form'

/** Vercel Blob folder holding signed order-form PDFs. */
export const ORDER_FORM_BLOB_DIRECTORY = 'fundraising/order-forms'

/** Mailing address for check payments, as printed on the paper form. */
export const ORDER_FORM_PAYMENT_ADDRESS = ['Jose Madrid Salsa', 'P.O. Box 1061', 'Zanesville, Ohio 43702'] as const
export const ORDER_FORM_PAYMENT_PHONE = '740-521-4304'

export interface OrderFormRecord extends OrderFormSubmission {
  id: string
  /** Short reference shown to the group and printed on the PDF, e.g. FO-1A2B3C. */
  code: string
  submittedAt: string
  totals: OrderFormTotals
  agreementText: string
  ipAddress: string | null
  userAgent: string | null
}

export function orderFormCode(id: string): string {
  return `FO-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

export function createOrderFormRecord(
  submission: OrderFormSubmission,
  context: { ipAddress?: string | null; userAgent?: string | null; now?: Date; id?: string } = {},
): OrderFormRecord {
  const id = context.id ?? globalThis.crypto.randomUUID()
  const totals = computeOrderFormTotals(submission.quantities)
  return {
    ...submission,
    id,
    code: orderFormCode(id),
    submittedAt: (context.now ?? new Date()).toISOString(),
    totals,
    agreementText: orderFormAgreementText(totals),
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }
}

export function formatOrderFormTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'long',
  }).format(new Date(iso))
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

/** Blob pathname (no extension), sorted by Eastern date, e.g. fundraising/order-forms/2026/09/2026-09-30-lincoln-pto-fo-1a2b3c */
export function buildOrderFormPathname(record: Pick<OrderFormRecord, 'submittedAt' | 'organizationName' | 'code'>): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(record.submittedAt))
  const [year, month] = date.split('-')
  return `${ORDER_FORM_BLOB_DIRECTORY}/${year}/${month}/${date}-${slugify(record.organizationName)}-${record.code.toLowerCase()}`
}

/** Line items actually ordered, in form order, for the PDF and emails. */
export function orderFormLineItems(record: Pick<OrderFormRecord, 'quantities'>) {
  return ORDER_FORM_CATEGORIES.flatMap((category) =>
    category.flavors
      .filter((flavor) => (record.quantities[flavor.id] ?? 0) > 0)
      .map((flavor) => {
        const jars = record.quantities[flavor.id] ?? 0
        return { category: category.label, label: orderFormFlavorLabel(flavor), jars, retailCents: jars * ORDER_FORM_RETAIL_CENTS }
      }),
  )
}

function shipToLines(record: OrderFormRecord): string[] {
  const { name, street, city, state, postalCode } = record.shipTo
  return [name, street, `${city}, ${state} ${postalCode}`]
}

const INK = rgb(0.11, 0.1, 0.09)
const MUTED = rgb(0.42, 0.4, 0.38)
const SALSA = rgb(0.725, 0.11, 0.11)
const RULE = rgb(0.85, 0.83, 0.8)

/** The signed order as a Letter PDF: header, contact, every flavor, totals, agreement and signature. */
export async function buildOrderFormPdf(record: OrderFormRecord): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Fundraiser Order Form - ${toPdfSafeText(record.organizationName)}`)
  pdf.setAuthor('Jose Madrid Salsa')
  pdf.setSubject(`Fundraiser order ${record.code}`)
  pdf.setCreationDate(new Date(record.submittedAt))

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

  const text = (value: string, x: number, options: { font?: PDFFont; size?: number; color?: typeof INK } = {}) => {
    const size = options.size ?? 10
    page.drawText(toPdfSafeText(value), { x, y: y - size, size, font: options.font ?? regular, color: options.color ?? INK })
  }

  const rightText = (value: string, right: number, options: { font?: PDFFont; size?: number } = {}) => {
    const font = options.font ?? regular
    const size = options.size ?? 10
    const safe = toPdfSafeText(value)
    page.drawText(safe, { x: right - font.widthOfTextAtSize(safe, size), y: y - size, size, font, color: INK })
  }

  const wrapped = (value: string, size: number, font: PDFFont = regular) => {
    const words = toPdfSafeText(value).split(' ')
    let line = ''
    const lines: string[] = []
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    for (const entry of lines) {
      ensureRoom(size * 1.45)
      text(entry, margin, { size, font })
      y -= size * 1.45
    }
  }

  text('JOSE MADRID SALSA', margin, { font: bold, size: 10, color: SALSA })
  rightText(record.code, margin + width, { font: bold, size: 12 })
  y -= 16
  text('Fundraiser Order Form', margin, { font: bold, size: 22 })
  y -= 28
  text(`Submitted ${formatOrderFormTimestamp(record.submittedAt)}`, margin, { size: 9, color: MUTED })
  y -= 22

  // Two columns: who is ordering, and where it ships.
  const columnX = margin + width / 2 + 8
  const left: Array<[string, string]> = [
    ['Fundraiser', record.organizationName],
    ['Submitted by', record.contactName],
    ['Email', record.email],
    ['Phone', record.phone],
  ]
  const right = ['Ship to', ...shipToLines(record)]
  const startY = y
  for (const [label, value] of left) {
    text(label.toUpperCase(), margin, { font: bold, size: 7.5, color: MUTED })
    y -= 10
    text(value, margin, { size: 10.5 })
    y -= 17
  }
  const leftEnd = y
  y = startY
  text(right[0].toUpperCase(), columnX, { font: bold, size: 7.5, color: MUTED })
  y -= 10
  for (const line of right.slice(1)) {
    text(line, columnX, { size: 10.5 })
    y -= 14
  }
  y = Math.min(leftEnd, y) - 6

  // Every flavor on the form, zeros included, like the paper original.
  const qtyRight = margin + width - 110
  const amountRight = margin + width
  const row = (label: string, qty: string, amount: string, options: { font?: PDFFont; size?: number } = {}) => {
    ensureRoom(15)
    text(label, margin + 10, options)
    rightText(qty, qtyRight, options)
    rightText(amount, amountRight, options)
    y -= 14
  }

  ensureRoom(20)
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 1, color: INK })
  y -= 6
  text('FLAVOR', margin + 10, { font: bold, size: 8 })
  rightText('JARS', qtyRight, { font: bold, size: 8 })
  rightText('@ $10.00', amountRight, { font: bold, size: 8 })
  y -= 14

  for (const category of ORDER_FORM_CATEGORIES) {
    ensureRoom(30)
    text(category.label.toUpperCase(), margin, { font: bold, size: 8.5, color: SALSA })
    rightText(String(record.totals.categoryJars[category.id] ?? 0), qtyRight, { font: bold, size: 8.5 })
    y -= 13
    for (const flavor of category.flavors) {
      const jars = record.quantities[flavor.id] ?? 0
      row(orderFormFlavorLabel(flavor), String(jars), jars ? formatOrderFormCents(jars * ORDER_FORM_RETAIL_CENTS) : '-', {
        font: jars ? bold : regular,
        size: 9.5,
      })
    }
    y -= 3
  }

  ensureRoom(90)
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 1, color: INK })
  y -= 8
  const { totals } = record
  row('Total jars', String(totals.totalJars), '', { font: bold, size: 11 })
  row('Total dollar amount (@ $10.00/jar)', '', formatOrderFormCents(totals.retailCents), { size: 11 })
  row(`Amount due for salsa (@ ${formatOrderFormCents(ORDER_FORM_DUE_CENTS)}/jar)`, '', formatOrderFormCents(totals.dueCents), {
    font: bold,
    size: 11,
  })
  row('Organization profit', '', formatOrderFormCents(totals.profitCents), { size: 11 })
  row(
    'Shipping',
    '',
    totals.freeShipping ? `Free (${ORDER_FORM_FREE_SHIPPING_JARS}+ jars)` : 'Quoted by Jose Madrid Salsa',
    { size: 11 },
  )
  y -= 8

  if (record.notes) {
    ensureRoom(30)
    text('NOTES', margin, { font: bold, size: 7.5, color: MUTED })
    y -= 11
    wrapped(record.notes, 9.5)
    y -= 6
  }

  // Agreement and signature always share a page.
  const signatureHeight = 70
  ensureRoom(signatureHeight + 110)
  page.drawRectangle({ x: margin, y: y - 2, width, height: 1, color: RULE })
  y -= 12
  text('AGREEMENT', margin, { font: bold, size: 7.5, color: MUTED })
  y -= 11
  wrapped(`[X] ${record.agreementText}`, 9.5)
  y -= 10

  // pdf-lib takes the data URL as-is.
  const png = await pdf.embedPng(record.signature)
  const scale = Math.min(260 / png.width, signatureHeight / png.height)
  page.drawImage(png, { x: margin, y: y - png.height * scale, width: png.width * scale, height: png.height * scale })
  y -= signatureHeight + 4
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 280, y }, thickness: 0.75, color: INK })
  y -= 4
  text(`Signed electronically by ${record.contactName}`, margin, { size: 9 })
  y -= 13
  text(
    `${formatOrderFormTimestamp(record.submittedAt)} - IP ${record.ipAddress ?? 'unknown'} - Ref ${record.code}`,
    margin,
    { size: 8, color: MUTED },
  )

  return pdf.save()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paymentInstructionsText(record: OrderFormRecord): string {
  return [
    `Amount due: ${formatOrderFormCents(record.totals.dueCents)}`,
    `Pay by check payable to "Jose Madrid Salsa" mailed to ${ORDER_FORM_PAYMENT_ADDRESS.join(', ')},`,
    `or call ${ORDER_FORM_PAYMENT_PHONE} to pay by credit card. Please reference ${record.code}.`,
  ].join('\n')
}

/** Summary email body shared by the internal notification and the group's copy. */
export function buildOrderFormEmail(
  record: OrderFormRecord,
  options: { audience: 'staff' | 'submitter'; pdfUrl: string | null },
): { subject: string; html: string; text: string } {
  const items = orderFormLineItems(record)
  const { totals } = record
  const subject =
    options.audience === 'staff'
      ? `Fundraiser order ${record.code}: ${record.organizationName} - ${totals.totalJars} jars`
      : `We received your fundraiser order (${record.code})`

  const intro =
    options.audience === 'staff'
      ? `${record.contactName} submitted a signed fundraiser order form for ${record.organizationName}.`
      : `Thank you, ${record.contactName}! We received the signed order form for ${record.organizationName}. Your order ships once payment is received.`

  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:4px 8px">${escapeHtml(item.label)}</td><td style="padding:4px 8px;text-align:right">${item.jars}</td><td style="padding:4px 8px;text-align:right">${formatOrderFormCents(item.retailCents)}</td></tr>`,
    )
    .join('')
  const shipTo = shipToLines(record).map(escapeHtml).join('<br/>')
  const shipping = totals.freeShipping ? 'Free' : 'We will confirm shipping with you'
  const pdfLink = options.pdfUrl
    ? `<p><a href="${escapeHtml(options.pdfUrl)}">Download the signed order form (PDF)</a></p>`
    : ''

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1917;max-width:640px">
<h2 style="margin:0 0 4px">Fundraiser order ${escapeHtml(record.code)}</h2>
<p>${escapeHtml(intro)}</p>
<p><strong>Fundraiser:</strong> ${escapeHtml(record.organizationName)}<br/>
<strong>Contact:</strong> ${escapeHtml(record.contactName)} &middot; ${escapeHtml(record.email)} &middot; ${escapeHtml(record.phone)}<br/>
<strong>Submitted:</strong> ${escapeHtml(formatOrderFormTimestamp(record.submittedAt))}</p>
<p><strong>Ship to:</strong><br/>${shipTo}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<thead><tr style="border-bottom:1px solid #1c1917"><th style="padding:4px 8px;text-align:left">Flavor</th><th style="padding:4px 8px;text-align:right">Jars</th><th style="padding:4px 8px;text-align:right">@ $10.00</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot style="border-top:1px solid #1c1917">
<tr><td style="padding:4px 8px"><strong>Total jars</strong></td><td style="padding:4px 8px;text-align:right"><strong>${totals.totalJars}</strong></td><td style="padding:4px 8px;text-align:right">${formatOrderFormCents(totals.retailCents)}</td></tr>
<tr><td style="padding:4px 8px" colspan="2"><strong>Amount due for salsa (@ $5.00/jar)</strong></td><td style="padding:4px 8px;text-align:right"><strong>${formatOrderFormCents(totals.dueCents)}</strong></td></tr>
<tr><td style="padding:4px 8px" colspan="2">Organization profit</td><td style="padding:4px 8px;text-align:right">${formatOrderFormCents(totals.profitCents)}</td></tr>
<tr><td style="padding:4px 8px" colspan="2">Shipping</td><td style="padding:4px 8px;text-align:right">${shipping}</td></tr>
</tfoot></table>
${record.notes ? `<p><strong>Notes:</strong><br/>${escapeHtml(record.notes).replace(/\n/g, '<br/>')}</p>` : ''}
${options.audience === 'submitter' ? `<p style="white-space:pre-line">${escapeHtml(paymentInstructionsText(record))}</p>` : ''}
${pdfLink}
<p style="color:#6b6560;font-size:12px">Signed electronically by ${escapeHtml(record.contactName)}. ${escapeHtml(record.agreementText)}</p>
</div>`

  const text = [
    intro,
    '',
    `Reference: ${record.code}`,
    `Fundraiser: ${record.organizationName}`,
    `Contact: ${record.contactName} (${record.email}, ${record.phone})`,
    `Ship to: ${shipToLines(record).join(', ')}`,
    '',
    ...items.map((item) => `${item.label}: ${item.jars}`),
    '',
    `Total jars: ${totals.totalJars}`,
    `Total dollar amount: ${formatOrderFormCents(totals.retailCents)}`,
    `Amount due for salsa: ${formatOrderFormCents(totals.dueCents)}`,
    `Organization profit: ${formatOrderFormCents(totals.profitCents)}`,
    `Shipping: ${shipping}`,
    ...(record.notes ? ['', `Notes: ${record.notes}`] : []),
    ...(options.audience === 'submitter' ? ['', paymentInstructionsText(record)] : []),
    ...(options.pdfUrl ? ['', `Signed order form: ${options.pdfUrl}`] : []),
  ].join('\n')

  return { subject, html, text }
}
