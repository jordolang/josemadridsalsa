/**
 * Counting and receiving stock with a barcode scanner.
 *
 * A USB or Bluetooth scanner is a keyboard: it types the code and presses
 * Enter. So the scan sheet is a text box, and what is here is the part worth
 * testing — matching what was typed to a product, and turning a tally of scans
 * into stock writes.
 *
 * The writes are the existing `inventory.adjust`, one per product, so a scanned
 * count goes through the same permission check, stale-count guard and
 * inventory transaction as one typed into the adjust sheet.
 */

import type { DesktopCommand } from './types'

export interface ScanProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  inventory: number
}

export type ScanMode = 'count' | 'receive'

/**
 * Digits only, leading zeros dropped. A UPC-A printed as 093662452874 reads
 * back as 0093662452874 from a scanner set to EAN-13, and as 93662452874 from
 * one that trims, and all three are the same jar.
 */
function normalise(code: string): string {
  return code.replace(/\D/g, '').replace(/^0+/, '')
}

/** The product a scan or a typed code names: its barcode, else its SKU. */
export function findByCode(products: ScanProduct[], code: string): ScanProduct | undefined {
  const typed = code.trim()
  if (!typed) return undefined
  const digits = normalise(typed)
  return (
    (digits.length >= 6 ? products.find((product) => product.barcode && normalise(product.barcode) === digits) : undefined) ??
    products.find((product) => product.sku.toLowerCase() === typed.toLowerCase())
  )
}

/** What a product's on-hand count becomes once the tally is applied. */
export function resultingCount(mode: ScanMode, product: ScanProduct, scanned: number): number {
  return mode === 'count' ? scanned : product.inventory + scanned
}

/**
 * The writes that apply a tally. A count sets each scanned product to what was
 * scanned; receiving adds what was scanned. Products not scanned are left alone
 * either way — a count only covers what was counted.
 */
export function tallyWrites(
  mode: ScanMode,
  tally: ReadonlyMap<string, number>,
): Extract<DesktopCommand, { kind: 'write' }>[] {
  return [...tally]
    .filter(([, scanned]) => mode === 'count' || scanned > 0)
    .map(([id, scanned]) => ({
      kind: 'write',
      op: 'inventory.adjust',
      recordId: id,
      values:
        mode === 'count'
          ? { mode: 'SET', amount: String(scanned), reason: 'Stock count (scanned)' }
          : { mode: 'DELTA', amount: String(scanned), reason: 'Received (scanned)' },
    }))
}
