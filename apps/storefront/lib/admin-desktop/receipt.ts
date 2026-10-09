/**
 * The order ticket the receipt printer prints when an order arrives.
 *
 * The kitchen printer is an 80mm ESC/POS thermal printer (a Rongta RP332), so
 * the ticket is built here as the printer's own bytes and the desktop app only
 * has to deliver them — over the network, or raw to an installed printer. One
 * encoder, on the server, means the macOS and Windows apps print the same
 * ticket and neither has to know what an order looks like.
 *
 * The ticket is for gathering the order: who it is for, every line with its
 * quantity large enough to read from across the table, and the order number as
 * a barcode, which the pack sheet scans to open that order.
 */

import { money, STORE_TIME_ZONE } from './format'

export interface ReceiptLine {
  quantity: number
  name: string
  sku: string
}

export interface ReceiptOrder {
  orderNumber: string
  createdAt: Date
  /** `WEBSITE`, `FUNDRAISER`, … as stored on the order. */
  salesChannel: string
  fundraiserName?: string | null
  customerName: string
  email?: string | null
  phone?: string | null
  /** Ship-to lines, already joined; empty when the order is not shipped. */
  address: string[]
  shippingMethod?: string | null
  items: ReceiptLine[]
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  customerNotes?: string | null
}

/** Font A on an 80mm head: 576 dots at 12 dots a character. */
export const RECEIPT_COLUMNS = 48

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const INIT = [ESC, 0x40]
const ALIGN_LEFT = [ESC, 0x61, 0]
const ALIGN_CENTER = [ESC, 0x61, 1]
const BOLD_ON = [ESC, 0x45, 1]
const BOLD_OFF = [ESC, 0x45, 0]
const SIZE_NORMAL = [GS, 0x21, 0x00]
const SIZE_TALL = [GS, 0x21, 0x01]
const SIZE_DOUBLE = [GS, 0x21, 0x11]
/** Feed four lines and make a partial cut, so the ticket tears off clean. */
const FEED_AND_CUT = [GS, 0x56, 66, 4]

const CHANNEL_LABEL: Record<string, string> = {
  WEBSITE: 'Website order',
  POS: 'In-store sale',
  FUNDRAISER: 'Fundraiser order',
  WHOLESALE: 'Wholesale order',
  EVENT: 'Event sale',
  MANUAL: 'Manual order',
  MARKETPLACE: 'Marketplace order',
  PHONE: 'Phone order',
  IMPORT: 'Imported order',
}

/**
 * Plain printable ASCII. The printer's default code page is not UTF-8, so an
 * accent is dropped to its base letter ("Jalapeño" prints as "Jalapeno") and
 * anything else that is not printable becomes a space — never a stray control
 * byte that the printer would read as a command.
 */
export function receiptText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e]/g, ' ')
}

/** Break text into lines no wider than `width`, on spaces where it can. */
export function wrap(value: string, width: number): string[] {
  const words = receiptText(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (let word of words) {
    while (word.length > width) {
      if (line) {
        lines.push(line)
        line = ''
      }
      lines.push(word.slice(0, width))
      word = word.slice(width)
    }
    if (!word) continue
    if (!line) line = word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** `left` and `right` on one line, the gap between them filled with spaces. */
function spread(left: string, right: string, width = RECEIPT_COLUMNS): string {
  const room = width - right.length - 1
  const head = receiptText(left).slice(0, Math.max(room, 0))
  return `${head}${' '.repeat(Math.max(width - head.length - right.length, 1))}${right}`
}

class Ticket {
  private bytes: number[] = [...INIT]

  raw(codes: number[]): this {
    this.bytes.push(...codes)
    return this
  }

  line(text = ''): this {
    for (const char of receiptText(text)) this.bytes.push(char.charCodeAt(0))
    this.bytes.push(LF)
    return this
  }

  rule(char = '-'): this {
    return this.line(char.repeat(RECEIPT_COLUMNS))
  }

  /** CODE128 (code set B), printed under its own text. */
  barcode(value: string): this {
    const data = receiptText(value).trim().slice(0, 40)
    if (!data) return this
    const payload = [0x7b, 0x42, ...[...data].map((char) => char.charCodeAt(0))]
    return this.raw([
      GS, 0x68, 80, // height in dots
      GS, 0x77, 2, // module width
      GS, 0x48, 2, // human-readable text below
      GS, 0x6b, 73, payload.length, ...payload,
      LF,
    ])
  }

  build(): Uint8Array {
    return Uint8Array.from([...this.bytes, ...FEED_AND_CUT])
  }
}

function formatPlaced(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: STORE_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** The printer's bytes for one order ticket, ending in a cut. */
export function buildReceipt(order: ReceiptOrder): Uint8Array {
  const ticket = new Ticket()
  const jars = order.items.reduce((sum, item) => sum + item.quantity, 0)

  ticket
    .raw([...ALIGN_CENTER, ...BOLD_ON])
    .line('JOSE MADRID SALSA')
    .raw(BOLD_OFF)
    .line(CHANNEL_LABEL[order.salesChannel] ?? 'New order')
    .raw(SIZE_DOUBLE)
    .line(order.orderNumber)
    .raw(SIZE_NORMAL)
    .line(formatPlaced(order.createdAt))
  if (order.fundraiserName) {
    for (const text of wrap(`Fundraiser: ${order.fundraiserName}`, RECEIPT_COLUMNS)) ticket.line(text)
  }

  ticket.raw(ALIGN_LEFT).rule()
  ticket.raw(BOLD_ON).line(order.address.length > 0 ? 'SHIP TO' : 'CUSTOMER').raw(BOLD_OFF)
  ticket.raw(SIZE_TALL).line(order.customerName).raw(SIZE_NORMAL)
  for (const part of order.address) for (const text of wrap(part, RECEIPT_COLUMNS)) ticket.line(text)
  if (order.phone) ticket.line(order.phone)
  if (order.email) ticket.line(order.email)
  if (order.shippingMethod) {
    for (const text of wrap(`Ship via: ${order.shippingMethod}`, RECEIPT_COLUMNS)) ticket.line(text)
  }

  ticket.rule().raw(BOLD_ON).line(spread('ITEMS', `${jars} ${jars === 1 ? 'JAR' : 'JARS'}`)).raw(BOLD_OFF)
  for (const item of order.items) {
    // The quantity is what a packer reads first, so it gets the big type.
    const quantity = `${item.quantity} x `
    const [first = '', ...rest] = wrap(item.name, RECEIPT_COLUMNS / 2 - quantity.length)
    ticket.raw([...SIZE_DOUBLE, ...BOLD_ON]).line(`${quantity}${first}`).raw([...SIZE_NORMAL, ...BOLD_OFF])
    for (const text of rest) ticket.raw(SIZE_DOUBLE).line(`${' '.repeat(quantity.length)}${text}`).raw(SIZE_NORMAL)
    ticket.line(`      SKU ${item.sku}`).line()
  }

  ticket.rule()
  ticket.line(spread('Subtotal', money(order.subtotal)))
  if (order.discount > 0) ticket.line(spread('Discount', `-${money(order.discount)}`))
  ticket.line(spread('Shipping', money(order.shipping)))
  if (order.tax > 0) ticket.line(spread('Tax', money(order.tax)))
  ticket.raw(BOLD_ON).line(spread('TOTAL', money(order.total))).raw(BOLD_OFF)

  if (order.customerNotes?.trim()) {
    ticket.rule().raw(BOLD_ON).line('CUSTOMER NOTE').raw(BOLD_OFF)
    for (const text of wrap(order.customerNotes, RECEIPT_COLUMNS)) ticket.line(text)
  }

  ticket.rule().raw(ALIGN_CENTER).line('Scan to pack and ship').barcode(order.orderNumber)
  return ticket.build()
}

/** Base64, for carrying the bytes in JSON to the desktop app. */
export function receiptBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}
