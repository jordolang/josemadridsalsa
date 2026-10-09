import { describe, it, expect } from 'vitest'
import { buildReceipt, receiptText, wrap, RECEIPT_COLUMNS, type ReceiptOrder } from '@/lib/admin-desktop/receipt'

const order: ReceiptOrder = {
  orderNumber: 'JMS-10452',
  createdAt: new Date('2026-10-08T22:15:00Z'),
  salesChannel: 'FUNDRAISER',
  fundraiserName: 'Zanesville High Band',
  customerName: 'María Peña',
  email: 'maria@example.com',
  phone: '740-555-0100',
  address: ['12 Main St', 'Zanesville, OH 43701'],
  shippingMethod: 'USPS Ground Advantage',
  items: [
    { quantity: 3, name: 'Peach Mild', sku: 'JMS-FRUIT-003' },
    { quantity: 1, name: 'Spanish Verde Hot', sku: 'JMS-HOT-010' },
  ],
  subtotal: 28,
  shipping: 9.5,
  tax: 0,
  discount: 2,
  total: 35.5,
  customerNotes: 'Gift — please no invoice',
}

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1')

describe('receiptText', () => {
  it('keeps the printer to plain ASCII, so no byte can read as a command', () => {
    expect(receiptText('Jalapeño “Hot” — 100%')).toBe('Jalapeno "Hot" - 100%')
    expect(receiptText('a\x1bb\x00c\n')).toBe('a b c ')
  })
})

describe('wrap', () => {
  it('breaks on spaces within the width', () => {
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four'])
  })

  it('splits a word longer than a line', () => {
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })
})

describe('buildReceipt', () => {
  const bytes = buildReceipt(order)
  const printed = text(bytes)

  it('starts by resetting the printer and ends with a cut', () => {
    expect([...bytes.slice(0, 2)]).toEqual([0x1b, 0x40])
    expect([...bytes.slice(-4)]).toEqual([0x1d, 0x56, 66, 4])
  })

  it('carries who it is for, every line and the totals', () => {
    for (const expected of [
      'JMS-10452',
      'Fundraiser order',
      'Fundraiser: Zanesville High Band',
      'Maria Pena',
      '12 Main St',
      '3 x Peach Mild',
      'SKU JMS-HOT-010',
      '4 JARS',
      'Gift - please no invoice',
      '$35.50',
    ]) {
      expect(printed).toContain(expected)
    }
  })

  it('prints the order number as a CODE128 barcode for the pack sheet to scan', () => {
    const payload = [0x7b, 0x42, ...Buffer.from('JMS-10452', 'latin1')]
    const command = [0x1d, 0x6b, 73, payload.length, ...payload]
    expect(printed).toContain(Buffer.from(command).toString('latin1'))
  })

  it('never writes a text line wider than the paper', () => {
    const long = buildReceipt({ ...order, customerNotes: 'x '.repeat(200), address: ['A'.repeat(120)] })
    const lines = text(long)
      .replace(/[\x1b\x1d][\s\S]{2}/g, '')
      .split('\n')
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(RECEIPT_COLUMNS + 4)
  })
})
