/**
 * The packing slip that goes in the box, as a self-contained HTML page.
 *
 * The desktop apps print it on the office printer in a window of its own with
 * scripts off and no network (the page's CSP allows inline styles and nothing
 * else), so it carries everything it needs and every value in it is escaped.
 * It is the insert the customer reads, so it says what is in the box and how
 * to reach us — no prices, which a gift recipient should not see.
 */

import { SITE_DOMAIN } from '@/lib/site-url'
import { STORE_TIME_ZONE } from './format'

export interface PackingSlipOrder {
  orderNumber: string
  createdAt: Date
  customerName: string
  address: string[]
  shippingMethod?: string | null
  trackingNumber?: string | null
  customerNotes?: string | null
  fundraiserName?: string | null
  items: { quantity: number; name: string; sku: string }[]
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char])
}

export function packingSlipHtml(order: PackingSlipOrder): string {
  const e = escapeHtml
  const placed = order.createdAt.toLocaleDateString('en-US', {
    timeZone: STORE_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const jars = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const rows = order.items
    .map((item) => `<tr><td class="qty">${item.quantity}</td><td>${e(item.name)}</td><td class="sku">${e(item.sku)}</td></tr>`)
    .join('')

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Packing slip ${e(order.orderNumber)}</title>
<style>
@page { size: letter; margin: 0.6in }
body { font: 12pt/1.4 Helvetica, Arial, sans-serif; color: #111; margin: 0 }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #b91c1c; padding-bottom: 12pt; margin-bottom: 18pt }
h1 { font-size: 20pt; color: #b91c1c; margin: 0 }
h2 { font-size: 14pt; margin: 0; text-align: right }
.dim { color: #555; font-size: 10pt; margin: 2pt 0 0 }
.box { border: 1px solid #ccc; border-radius: 4pt; padding: 10pt 12pt; margin-bottom: 18pt }
.label { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .05em; color: #555; margin: 0 0 6pt }
.box p { margin: 0 }
table { width: 100%; border-collapse: collapse; margin-bottom: 18pt }
th { text-align: left; font-size: 10pt; border-bottom: 2px solid #999; padding: 6pt }
td { border-bottom: 1px solid #ddd; padding: 8pt 6pt; vertical-align: top }
.qty { width: 48pt; font-weight: bold; text-align: center }
.sku { width: 120pt; font-family: Menlo, Consolas, monospace; font-size: 10pt; color: #555 }
tfoot td { border: 0; font-weight: bold }
footer { margin-top: 24pt; text-align: center; color: #555; font-size: 10pt }
</style></head><body>
<header>
  <div><h1>Jose Madrid Salsa</h1><p class="dim">${e(SITE_DOMAIN)} &middot; Zanesville, Ohio</p></div>
  <div><h2>Packing slip</h2><p class="dim" style="text-align:right">Order ${e(order.orderNumber)}<br>${e(placed)}</p></div>
</header>
<div class="box">
  <p class="label">Ship to</p>
  <p><strong>${e(order.customerName)}</strong></p>
  ${order.address.map((line) => `<p>${e(line)}</p>`).join('')}
</div>
${order.fundraiserName ? `<p>Supporting <strong>${e(order.fundraiserName)}</strong> &mdash; thank you!</p>` : ''}
<table>
  <thead><tr><th class="qty">Qty</th><th>Item</th><th class="sku">SKU</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td class="qty">${jars}</td><td>${jars === 1 ? 'jar' : 'jars'} in this box</td><td></td></tr></tfoot>
</table>
${order.shippingMethod ? `<p class="dim">Shipped via ${e(order.shippingMethod)}</p>` : ''}
${order.trackingNumber ? `<p class="dim">Tracking number <strong>${e(order.trackingNumber)}</strong></p>` : ''}
${order.customerNotes?.trim() ? `<div class="box"><p class="label">Your note</p><p>${e(order.customerNotes)}</p></div>` : ''}
<footer>Thank you for supporting a family salsa company. Questions about your order? Visit ${e(SITE_DOMAIN)}.</footer>
</body></html>`
}
