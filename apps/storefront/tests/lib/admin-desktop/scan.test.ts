import { describe, it, expect } from 'vitest'
import { findByCode, resultingCount, tallyWrites, type ScanProduct } from '@/lib/admin-desktop/scan'

const peach: ScanProduct = { id: 'p1', name: 'Peach Mild', sku: 'JMS-FRUIT-003', barcode: '093662452874', inventory: 10 }
const verde: ScanProduct = { id: 'p2', name: 'Spanish Verde Hot', sku: 'JMS-HOT-010', barcode: null, inventory: 4 }
const products = [peach, verde]

describe('findByCode', () => {
  it('matches a UPC however the scanner pads it', () => {
    for (const code of ['093662452874', '0093662452874', '93662452874', ' 093662452874\n']) {
      expect(findByCode(products, code)?.id).toBe('p1')
    }
  })

  it('falls back to the SKU for a jar with no barcode, typed by hand', () => {
    expect(findByCode(products, 'jms-hot-010')?.id).toBe('p2')
  })

  it('finds nothing for an unknown or empty code', () => {
    expect(findByCode(products, '012345678905')).toBeUndefined()
    expect(findByCode(products, '')).toBeUndefined()
    // A short run of digits is not a barcode, so it cannot match one by accident.
    expect(findByCode([{ ...peach, barcode: '0000012' }], '12')).toBeUndefined()
  })
})

describe('resultingCount', () => {
  it('sets on a count and adds on a receipt', () => {
    expect(resultingCount('count', peach, 7)).toBe(7)
    expect(resultingCount('receive', peach, 7)).toBe(17)
  })
})

describe('tallyWrites', () => {
  const tally = new Map([
    ['p1', 7],
    ['p2', 0],
  ])

  it('sets each counted product to what was scanned, including a count of zero', () => {
    expect(tallyWrites('count', tally)).toEqual([
      { kind: 'write', op: 'inventory.adjust', recordId: 'p1', values: { mode: 'SET', amount: '7', reason: 'Stock count (scanned)' } },
      { kind: 'write', op: 'inventory.adjust', recordId: 'p2', values: { mode: 'SET', amount: '0', reason: 'Stock count (scanned)' } },
    ])
  })

  it('adds what was received and skips nothing-received', () => {
    expect(tallyWrites('receive', tally)).toEqual([
      { kind: 'write', op: 'inventory.adjust', recordId: 'p1', values: { mode: 'DELTA', amount: '7', reason: 'Received (scanned)' } },
    ])
  })
})
