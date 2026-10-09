import { describe, it, expect } from 'vitest'
import { isPacked, packedUnits, packScan, unpack, type PackLine } from '@/lib/admin-desktop/pack'

const lines: PackLine[] = [
  { id: 'i1', name: 'Peach Mild', sku: 'JMS-FRUIT-003', barcode: '093662452874', quantity: 2, packed: 0 },
  { id: 'i2', name: 'Spanish Verde Hot', sku: 'JMS-HOT-010', barcode: null, quantity: 1, packed: 0 },
]

describe('packScan', () => {
  it('ticks a unit off the line the jar belongs to', () => {
    const { lines: next, outcome } = packScan(lines, '0093662452874')
    expect(outcome).toMatchObject({ kind: 'packed', line: { id: 'i1', packed: 1 } })
    expect(next[0].packed).toBe(1)
    expect(lines[0].packed).toBe(0)
  })

  it('takes a typed SKU for a jar with no barcode', () => {
    expect(packScan(lines, 'jms-hot-010').outcome).toMatchObject({ kind: 'packed', line: { id: 'i2' } })
  })

  it('refuses one jar too many rather than counting it', () => {
    const full = lines.map((line) => ({ ...line, packed: line.quantity }))
    const { lines: next, outcome } = packScan(full, '093662452874')
    expect(outcome).toMatchObject({ kind: 'extra', line: { id: 'i1' } })
    expect(next).toBe(full)
  })

  it('refuses a jar that is not on the order', () => {
    expect(packScan(lines, '012345678905').outcome).toEqual({ kind: 'unknown' })
  })

  it('fills the next line of the same product once the first is full', () => {
    const split = [lines[0], { ...lines[0], id: 'i3', quantity: 1 }]
    const once = packScan(split.map((line, index) => (index === 0 ? { ...line, packed: 2 } : line)), '093662452874')
    expect(once.outcome).toMatchObject({ kind: 'packed', line: { id: 'i3' } })
  })
})

describe('isPacked', () => {
  it('is true only when every unit is scanned', () => {
    let state = lines
    for (const code of ['093662452874', '093662452874']) state = packScan(state, code).lines
    expect(isPacked(state)).toBe(false)
    state = packScan(state, 'JMS-HOT-010').lines
    expect(packedUnits(state)).toEqual({ packed: 3, total: 3 })
    expect(isPacked(state)).toBe(true)
    expect(isPacked(unpack(state, 'i1'))).toBe(false)
  })

  it('is false for an order with nothing to pack', () => {
    expect(isPacked([])).toBe(false)
  })
})
