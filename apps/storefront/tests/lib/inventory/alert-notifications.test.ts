import { describe, expect, it } from 'vitest'

import { inventoryAlertSpec } from '@/lib/inventory/alert-notifications'

const base = {
  productId: 'prod_1',
  productName: 'Black Bean & Corn',
  sku: 'JMS-BBC-16',
  stockLevel: 3,
  threshold: 10,
  outOfStock: false,
}

describe('inventoryAlertSpec', () => {
  it('describes low stock with the number and the threshold that triggered it', () => {
    const spec = inventoryAlertSpec(base)
    expect(spec.type).toBe('INVENTORY_LOW')
    expect(spec.severity).toBe('WARNING')
    expect(spec.title).toBe('Black Bean & Corn is running low')
    expect(spec.message).toContain('down to 3')
    expect(spec.message).toContain('threshold of 10')
  })

  it('escalates out of stock to critical', () => {
    const spec = inventoryAlertSpec({ ...base, stockLevel: 0, outOfStock: true })
    expect(spec.type).toBe('INVENTORY_OUT_OF_STOCK')
    expect(spec.severity).toBe('CRITICAL')
    expect(spec.title).toBe('Black Bean & Corn is out of stock')
  })

  it('includes the SKU so a name collision is still identifiable', () => {
    expect(inventoryAlertSpec(base).message).toContain('(JMS-BBC-16)')
  })

  it('omits the SKU parenthetical when there is none', () => {
    const spec = inventoryAlertSpec({ ...base, sku: null })
    expect(spec.message).toContain('Black Bean & Corn')
    expect(spec.message).not.toContain('(')
  })

  it('links to the product it is about', () => {
    expect(inventoryAlertSpec(base).link).toBe('/admin/inventory?productId=prod_1')
    expect(inventoryAlertSpec(base).entityId).toBe('prod_1')
    expect(inventoryAlertSpec(base).entityType).toBe('product')
  })

  it('keys the dedupe on the product, so a restock-and-relapse updates one line', () => {
    const first = inventoryAlertSpec(base)
    const later = inventoryAlertSpec({ ...base, stockLevel: 1 })
    expect(first.dedupeKey).toBe('inventory-low:prod_1')
    expect(later.dedupeKey).toBe(first.dedupeKey)
  })

  it('separates the low and out-of-stock keys, which are different situations', () => {
    const low = inventoryAlertSpec(base)
    const out = inventoryAlertSpec({ ...base, stockLevel: 0, outOfStock: true })
    // Selling the last unit should raise a new critical line, not silently overwrite the
    // warning that preceded it.
    expect(out.dedupeKey).not.toBe(low.dedupeKey)
    expect(out.dedupeKey).toBe('inventory-out:prod_1')
  })
})
