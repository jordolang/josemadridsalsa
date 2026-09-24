import type { FeedProduct } from './products'
import { SITE_URL as DEFAULT_SITE_URL } from '@/lib/site-url'

/**
 * Google Merchant Center product feed, in both supported flavors:
 *
 *  - RSS 2.0 XML with the `g:` namespace (the canonical "product data feed")
 *  - Tab-delimited text (the spreadsheet-style alternative)
 *
 * Field reference: https://support.google.com/merchants/answer/7052112.
 * Microsoft (Bing) Shopping and Pinterest catalogs both accept this same
 * Google-format feed, so those platforms reuse these builders.
 */

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_SITE_URL

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function tag(name: string, value: string): string {
  return `<${name}>${xmlEscape(value)}</${name}>`
}

/** Products without an image are rejected by Google — feed only valid items. */
function feedableProducts(products: FeedProduct[]): FeedProduct[] {
  return products.filter((product) => product.imageLink !== null)
}

export function buildGoogleShoppingXml(products: FeedProduct[]): string {
  const items = feedableProducts(products).map((product) => {
    const lines = [
      tag('g:id', product.sku),
      tag('g:title', product.title),
      tag('g:description', product.description),
      tag('g:link', product.link),
      tag('g:image_link', product.imageLink!),
      ...product.additionalImageLinks.map((url) => tag('g:additional_image_link', url)),
      tag('g:availability', product.availability),
      tag('g:price', `${product.regularPrice.toFixed(2)} USD`),
      ...(product.salePrice !== null
        ? [tag('g:sale_price', `${product.salePrice.toFixed(2)} USD`)]
        : []),
      tag('g:brand', product.brand),
      // Google requires a GTIN when one exists; otherwise the merchant must
      // declare that no unique identifier exists for the product.
      ...(product.gtin
        ? [tag('g:gtin', product.gtin)]
        : [tag('g:identifier_exists', 'no')]),
      tag('g:condition', 'new'),
      tag('g:google_product_category', product.googleProductCategory),
      ...(product.weightOz !== null
        ? [tag('g:shipping_weight', `${product.weightOz} oz`)]
        : []),
    ]
    return `    <item>\n      ${lines.join('\n      ')}\n    </item>`
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    '  <channel>',
    `    ${tag('title', 'Jose Madrid Salsa')}`,
    `    ${tag('link', SITE_URL)}`,
    `    ${tag('description', 'Jose Madrid Salsa product feed')}`,
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n')
}

const TSV_COLUMNS = [
  'id',
  'title',
  'description',
  'link',
  'image_link',
  'additional_image_link',
  'availability',
  'price',
  'sale_price',
  'brand',
  'gtin',
  'identifier_exists',
  'condition',
  'google_product_category',
] as const

/** Tab-delimited cells cannot contain tabs or line breaks. */
function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim()
}

export function buildGoogleShoppingTsv(products: FeedProduct[]): string {
  const rows = feedableProducts(products).map((product) => {
    const values: Record<(typeof TSV_COLUMNS)[number], string> = {
      id: product.sku,
      title: product.title,
      description: product.description,
      link: product.link,
      image_link: product.imageLink!,
      additional_image_link: product.additionalImageLinks.join(','),
      availability: product.availability,
      price: `${product.regularPrice.toFixed(2)} USD`,
      sale_price: product.salePrice !== null ? `${product.salePrice.toFixed(2)} USD` : '',
      brand: product.brand,
      gtin: product.gtin ?? '',
      identifier_exists: product.gtin ? 'yes' : 'no',
      condition: 'new',
      google_product_category: product.googleProductCategory,
    }
    return TSV_COLUMNS.map((column) => tsvCell(values[column])).join('\t')
  })

  return [TSV_COLUMNS.join('\t'), ...rows].join('\n')
}
