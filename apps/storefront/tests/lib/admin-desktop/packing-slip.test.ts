import { describe, it, expect } from 'vitest'
import { packingSlipHtml } from '@/lib/admin-desktop/packing-slip'

describe('packingSlipHtml', () => {
  const html = packingSlipHtml({
    orderNumber: 'JMS-10452',
    createdAt: new Date('2026-10-08T22:15:00Z'),
    customerName: '<script>alert(1)</script>',
    address: ['12 Main St', 'Zanesville, OH 43701'],
    trackingNumber: '9400100000000000000000',
    items: [{ quantity: 3, name: 'Peach & Mango', sku: 'JMS-FRUIT-003' }],
  })

  it('escapes everything it was given', () => {
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Peach &amp; Mango')
  })

  it('locks the page down to inline styles', () => {
    expect(html).toContain(`default-src 'none'; style-src 'unsafe-inline'`)
  })

  it('lists what is in the box and the tracking number, but no prices', () => {
    expect(html).toContain('3</td><td>Peach &amp; Mango')
    expect(html).toContain('9400100000000000000000')
    expect(html).not.toContain('$')
  })
})
