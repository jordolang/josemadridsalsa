import { describe, expect, it } from 'vitest'
import type { FeedProduct } from '@/lib/feeds/products'
import { buildFacebookCatalogCsv } from '@/lib/feeds/facebook'
import { buildGoogleShoppingTsv, buildGoogleShoppingXml } from '@/lib/feeds/google'
import { buildAmazonInventoryTsv } from '@/lib/feeds/amazon'

function makeProduct(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    sku: 'SALSA-001',
    title: 'Original Mild Salsa',
    description: 'Classic mild salsa with "fresh" tomatoes & peppers.',
    link: 'https://www.josemadrid.net/products/original-mild',
    imageLink: 'https://www.josemadrid.net/images/original-mild.jpg',
    additionalImageLinks: ['https://www.josemadrid.net/images/original-mild-2.jpg'],
    regularPrice: 9.99,
    salePrice: null,
    availability: 'in stock',
    inventory: 25,
    brand: 'Jose Madrid Salsa',
    gtin: '012345678905',
    weightOz: 16,
    googleProductCategory:
      'Food, Beverages & Tobacco > Food Items > Condiments & Sauces > Salsa',
    ...overrides,
  }
}

describe('buildFacebookCatalogCsv', () => {
  it('emits a header row plus one row per product', () => {
    const csv = buildFacebookCatalogCsv([makeProduct(), makeProduct({ sku: 'SALSA-002' })])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('id,title,description,availability')
    expect(lines[1]).toContain('"SALSA-001"')
  })

  it('escapes embedded double quotes per RFC 4180', () => {
    const csv = buildFacebookCatalogCsv([makeProduct()])
    expect(csv).toContain('""fresh""')
  })

  it('skips products without an image', () => {
    const csv = buildFacebookCatalogCsv([makeProduct({ imageLink: null })])
    expect(csv.split('\n')).toHaveLength(1)
  })

  it('splits regular and sale price when discounted', () => {
    const csv = buildFacebookCatalogCsv([
      makeProduct({ regularPrice: 12.99, salePrice: 9.99 }),
    ])
    expect(csv).toContain('"12.99 USD","9.99 USD"')
  })
})

describe('buildGoogleShoppingXml', () => {
  it('produces an RSS feed with g: namespace items', () => {
    const xml = buildGoogleShoppingXml([makeProduct()])
    expect(xml).toContain('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">')
    expect(xml).toContain('<g:id>SALSA-001</g:id>')
    expect(xml).toContain('<g:price>9.99 USD</g:price>')
    expect(xml).toContain('<g:gtin>012345678905</g:gtin>')
    expect(xml).toContain('<g:shipping_weight>16 oz</g:shipping_weight>')
    expect(xml).not.toContain('<g:sale_price>')
    expect(xml).not.toContain('<g:identifier_exists>')
  })

  it('escapes XML special characters', () => {
    const xml = buildGoogleShoppingXml([makeProduct({ title: 'Hot & Spicy <3' })])
    expect(xml).toContain('<g:title>Hot &amp; Spicy &lt;3</g:title>')
  })

  it('declares identifier_exists=no when there is no GTIN', () => {
    const xml = buildGoogleShoppingXml([makeProduct({ gtin: null })])
    expect(xml).toContain('<g:identifier_exists>no</g:identifier_exists>')
    expect(xml).not.toContain('<g:gtin>')
  })

  it('includes sale_price only when discounted and skips imageless products', () => {
    const xml = buildGoogleShoppingXml([
      makeProduct({ regularPrice: 12.99, salePrice: 9.99 }),
      makeProduct({ sku: 'NO-IMAGE', imageLink: null }),
    ])
    expect(xml).toContain('<g:sale_price>9.99 USD</g:sale_price>')
    expect(xml).not.toContain('NO-IMAGE')
  })
})

describe('buildGoogleShoppingTsv', () => {
  it('emits tab-delimited rows with sanitized cells', () => {
    const tsv = buildGoogleShoppingTsv([
      makeProduct({ description: 'line one\nline two\twith tab' }),
    ])
    const lines = tsv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].split('\t')[0]).toBe('id')
    expect(lines[1]).toContain('line one line two with tab')
    expect(lines[1].split('\t')).toHaveLength(lines[0].split('\t').length)
  })
})

describe('buildAmazonInventoryTsv', () => {
  it('maps UPC products to product-id-type 3 with condition New', () => {
    const tsv = buildAmazonInventoryTsv([makeProduct()])
    const lines = tsv.split('\n')
    expect(lines[0]).toBe(
      'sku\tproduct-id\tproduct-id-type\tprice\titem-condition\tquantity\tadd-delete\titem-note',
    )
    expect(lines[1]).toBe('SALSA-001\t012345678905\t3\t9.99\t11\t25\ta\t')
  })

  it('leaves product-id blank when the product has no barcode', () => {
    const tsv = buildAmazonInventoryTsv([makeProduct({ gtin: null })])
    expect(tsv.split('\n')[1]).toBe('SALSA-001\t\t\t9.99\t11\t25\ta\t')
  })

  it('uses the sale price when discounted and clamps negative inventory', () => {
    const tsv = buildAmazonInventoryTsv([
      makeProduct({ regularPrice: 12.99, salePrice: 9.99, inventory: -3 }),
    ])
    const cells = tsv.split('\n')[1].split('\t')
    expect(cells[3]).toBe('9.99')
    expect(cells[5]).toBe('0')
  })

  it('includes products without images (Amazon matches by identifier)', () => {
    const tsv = buildAmazonInventoryTsv([makeProduct({ imageLink: null })])
    expect(tsv.split('\n')).toHaveLength(2)
  })
})
