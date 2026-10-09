/**
 * Packing an order by scanning every jar into the box.
 *
 * The scanner is a keyboard, as on the stock scan sheet: it types a code and
 * presses Enter. Each scan ticks one unit off the line it matches, and the
 * order is ready to ship when every line is fully scanned. A jar that is not
 * on the order, or one too many of a line, is refused out loud rather than
 * counted, which is the whole point of scanning: the wrong salsa never reaches
 * the box unnoticed.
 *
 * Postage is bought only once `isPacked` says so. Buying a label spends money,
 * so a half-scanned order never triggers it.
 */

import { findByCode } from './scan'

export interface PackLine {
  /** The order item. */
  id: string
  name: string
  sku: string
  barcode: string | null
  /** Units still to pack on this line — what was ordered less what already shipped. */
  quantity: number
  packed: number
}

export type PackOutcome =
  | { kind: 'packed'; line: PackLine }
  | { kind: 'extra'; line: PackLine }
  | { kind: 'unknown' }

const asProduct = (line: PackLine) => ({ id: line.id, name: line.name, sku: line.sku, barcode: line.barcode, inventory: 0 })

/**
 * Apply one scan. The same product can sit on two lines, so a scan goes to the
 * first line of it that still has room, and only counts as one too many once
 * every line of it is full.
 */
export function packScan(lines: PackLine[], code: string): { lines: PackLine[]; outcome: PackOutcome } {
  const open = lines.filter((line) => line.packed < line.quantity)
  const target = findByCode(open.map(asProduct), code)
  if (target) {
    const next = lines.map((line) => (line.id === target.id ? { ...line, packed: line.packed + 1 } : line))
    return { lines: next, outcome: { kind: 'packed', line: next.find((line) => line.id === target.id)! } }
  }

  const full = findByCode(lines.map(asProduct), code)
  const line = full && lines.find((entry) => entry.id === full.id)
  return { lines, outcome: line ? { kind: 'extra', line } : { kind: 'unknown' } }
}

/** Take one back off a line, for a jar scanned and then pulled out of the box. */
export function unpack(lines: PackLine[], id: string): PackLine[] {
  return lines.map((line) => (line.id === id ? { ...line, packed: Math.max(0, line.packed - 1) } : line))
}

export function packedUnits(lines: PackLine[]): { packed: number; total: number } {
  return lines.reduce(
    (sum, line) => ({ packed: sum.packed + Math.min(line.packed, line.quantity), total: sum.total + line.quantity }),
    { packed: 0, total: 0 },
  )
}

/** Every unit of every line is in the box. An order with nothing left to pack is not "packed". */
export function isPacked(lines: PackLine[]): boolean {
  const { packed, total } = packedUnits(lines)
  return total > 0 && packed === total
}
