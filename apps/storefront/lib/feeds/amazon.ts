import type { FeedProduct } from './products'

/**
 * Amazon Inventory Loader flat file (tab-delimited).
 *
 * This is the upload format Seller Central accepts under
 * Catalog → Add Products via Upload. Rows match against Amazon's existing
 * catalog by UPC (`product-id-type` 3) — Amazon merges the offer onto the
 * matching ASIN with our price and quantity. Products without a barcode are
 * emitted with a blank product-id, which Amazon resolves only when the SKU
 * already exists in the seller account.
 *
 * Creating brand-new ASINs (products Amazon has never seen) requires the
 * category-specific listing template or the SP-API Listings feed instead —
 * this file intentionally covers the price/quantity/offer path that works
 * without extra credentials.
 */

const COLUMNS = [
  'sku',
  'product-id',
  'product-id-type',
  'price',
  'item-condition',
  'quantity',
  'add-delete',
  'item-note',
] as const

/** Amazon condition code for "New". */
const CONDITION_NEW = '11'
/** Amazon product-id-type code for UPC. */
const PRODUCT_ID_TYPE_UPC = '3'

/** Tab-delimited cells cannot contain tabs or line breaks. */
function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim()
}

export function buildAmazonInventoryTsv(products: FeedProduct[]): string {
  const rows = products.map((product) => {
    // Amazon takes the buyable price: the sale price when discounted,
    // otherwise the regular price.
    const price = product.salePrice ?? product.regularPrice

    const values: Record<(typeof COLUMNS)[number], string> = {
      sku: product.sku,
      'product-id': product.gtin ?? '',
      'product-id-type': product.gtin ? PRODUCT_ID_TYPE_UPC : '',
      price: price.toFixed(2),
      'item-condition': CONDITION_NEW,
      quantity: String(Math.max(product.inventory, 0)),
      'add-delete': 'a',
      'item-note': '',
    }
    return COLUMNS.map((column) => tsvCell(values[column])).join('\t')
  })

  return [COLUMNS.join('\t'), ...rows].join('\n')
}
