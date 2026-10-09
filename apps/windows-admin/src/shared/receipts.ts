import { isInternalUrl } from './endpoint'

/**
 * The receipt printer: an 80mm ESC/POS thermal printer that prints a ticket
 * for every order that comes in.
 *
 * The admin page builds the ticket's bytes on the server and hands them over;
 * this side checks them, decides whether the order has already been printed,
 * and delivers them. Kept free of Electron so it can be tested.
 */

/**
 * Where the tickets go. `network` is the printer's Ethernet port (raw TCP,
 * 9100 on nearly every ESC/POS printer). `printer` is a printer installed in
 * the system — the USB connection, through the manufacturer's driver — sent
 * the bytes raw so the driver does not try to lay them out as a page.
 */
export type ReceiptPrinter =
  | { mode: 'off' }
  | { mode: 'network'; host: string; port: number }
  | { mode: 'printer'; name: string }

export const RECEIPTS_OFF: ReceiptPrinter = { mode: 'off' }

export interface ReceiptJob {
  orderId: string
  /** For telling the operator which ticket did not print. */
  orderNumber: string
  /** When the order was placed. */
  createdAt: number
  bytes: Buffer
  /** A reprint asked for by hand: printed even if it was printed before. */
  reprint: boolean
}

/** A ticket is a few hundred bytes; anything near this is not a ticket. */
const MAX_TICKET_BYTES = 64 * 1024

/** Order ids remembered as printed. Far more than a day's orders, small enough to keep in the settings file. */
export const PRINTED_MEMORY = 500

const HOST = /^[A-Za-z0-9.-]{1,253}$|^\[?[0-9A-Fa-f:]{2,39}\]?$/

/** A receipt printer setting from the settings page or the settings file, or an error to show. */
export function parseReceiptPrinter(value: unknown): ReceiptPrinter | { error: string } {
  if (typeof value !== 'object' || value === null) return RECEIPTS_OFF
  const { mode, host, port, name } = value as Record<string, unknown>

  if (mode === 'network') {
    const trimmed = typeof host === 'string' ? host.trim() : ''
    if (!HOST.test(trimmed)) return { error: "Enter the receipt printer's IP address, like 192.168.1.87." }
    const number = typeof port === 'number' ? port : Number(port || 9100)
    if (!Number.isInteger(number) || number < 1 || number > 65535) return { error: 'The port is a number from 1 to 65535, usually 9100.' }
    return { mode: 'network', host: trimmed.replace(/^\[|\]$/g, ''), port: number }
  }

  if (mode === 'printer') {
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 200) : ''
    if (!trimmed) return { error: 'Choose the receipt printer from the list.' }
    return { mode: 'printer', name: trimmed }
  }

  return RECEIPTS_OFF
}

/**
 * A ticket the admin page asks to print: from the admin origin's top frame,
 * with an order id, a placed time and base64 bytes of a sane size.
 */
export function parseReceiptJob(endpoint: string, senderUrl: string, value: unknown): ReceiptJob | null {
  if (!isInternalUrl(endpoint, senderUrl) || typeof value !== 'object' || value === null) return null
  const { orderId, orderNumber, createdAt, data, reprint } = value as Record<string, unknown>

  if (typeof orderId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(orderId)) return null
  const placed = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN
  if (!Number.isFinite(placed)) return null
  if (typeof data !== 'string' || data.length === 0 || data.length > (MAX_TICKET_BYTES * 4) / 3 + 4) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null

  const bytes = Buffer.from(data, 'base64')
  if (bytes.length === 0 || bytes.length > MAX_TICKET_BYTES) return null
  const number = typeof orderNumber === 'string' ? orderNumber.replace(/[^\x20-\x7e]/g, '').slice(0, 40) : ''
  return { orderId, orderNumber: number, createdAt: placed, bytes, reprint: reprint === true }
}

/**
 * Whether this ticket should print, given what has printed already and when
 * receipts were switched on.
 *
 * An order placed before receipts were switched on is the backlog, which was
 * presumably already dealt with on paper; one already printed would be a
 * duplicate. A hand reprint skips both checks.
 */
export function shouldPrint(job: ReceiptJob, printed: readonly string[], enabledAt: number): boolean {
  if (job.reprint) return true
  return job.createdAt >= enabledAt && !printed.includes(job.orderId)
}

/** The printed list with this order added, the oldest dropped past the limit. */
export function remember(printed: readonly string[], orderId: string): string[] {
  return [...printed.filter((id) => id !== orderId), orderId].slice(-PRINTED_MEMORY)
}

/** The printer's own test page: a few lines and a cut, from the settings page's Test button. */
export function testTicket(now: Date): Buffer {
  const text = [
    'Jose Madrid Salsa',
    'Receipt printer test',
    now.toLocaleString('en-US'),
    '',
    'New orders will print here.',
  ].join('\n')
  return Buffer.concat([
    Buffer.from([0x1b, 0x40, 0x1b, 0x61, 1]),
    Buffer.from(`${text}\n`, 'latin1'),
    Buffer.from([0x1d, 0x56, 66, 4]),
  ])
}
