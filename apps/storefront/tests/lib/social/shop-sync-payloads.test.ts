import { describe, expect, it } from 'vitest'
import {
  buildAmazonListingPayload,
  DEFAULT_AMAZON_PRODUCT_TYPE,
  type AmazonListingProduct,
} from '@/lib/social/amazon-sp-api'
import {
  buildGoogleShoppingProduct,
  type GoogleShoppingProduct,
} from '@/lib/social/google-content-api'

const MARKETPLACE = 'ATVPDKIKX0DER'

function makeAmazonProduct(overrides: Partial<AmazonListingProduct> = {}): AmazonListingProduct {
  return {
    name: 'Original Mild Salsa',
    description: 'Classic mild salsa.',
    sku: 'SALSA-001',
    price: 9.99,
    images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    featuredImage: 'https://example.com/a.jpg',
    inventory: 25,
    gtin: '012345678905',
    weightOz: 16,
    ...overrides,
  }
}

function makeGoogleProduct(overrides: Partial<GoogleShoppingProduct> = {}): GoogleShoppingProduct {
  return {
    name: 'Original Mild Salsa',
    description: 'Classic mild salsa.',
    sku: 'SALSA-001',
    price: 9.99,
    compareAtPrice: null,
    images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    featuredImage: 'https://example.com/a.jpg',
    inventory: 25,
    url: 'https://www.josemadrid.net/products/original-mild',
    gtin: '012345678905',
    weightOz: 16,
    ...overrides,
  }
}

describe('buildAmazonListingPayload', () => {
  it('maps core attributes onto the CONDIMENT product type', () => {
    const payload = buildAmazonListingPayload(makeAmazonProduct(), {}, MARKETPLACE)

    expect(payload.productType).toBe(DEFAULT_AMAZON_PRODUCT_TYPE)
    expect(payload.requirements).toBe('LISTING')
    expect(payload.attributes.item_name).toEqual([
      { value: 'Original Mild Salsa', language_tag: 'en_US', marketplace_id: MARKETPLACE },
    ])
    expect(payload.attributes.externally_assigned_product_identifier).toEqual([
      { type: 'upc', value: '012345678905', marketplace_id: MARKETPLACE },
    ])
    expect(payload.attributes.fulfillment_availability).toEqual([
      { fulfillment_channel_code: 'DEFAULT', quantity: 25 },
    ])
    expect(payload.attributes.main_product_image_locator).toEqual([
      { media_location: 'https://example.com/a.jpg', marketplace_id: MARKETPLACE },
    ])
    expect(payload.attributes.item_package_weight).toEqual([
      { value: 16, unit: 'ounces', marketplace_id: MARKETPLACE },
    ])
  })

  it('applies listing overrides for title, price, and product type', () => {
    const payload = buildAmazonListingPayload(
      makeAmazonProduct(),
      { title: 'Custom Title', price: 12.5, category: 'SAUCE' },
      MARKETPLACE,
    )
    expect(payload.productType).toBe('SAUCE')
    expect((payload.attributes.item_name as Array<{ value: string }>)[0].value).toBe(
      'Custom Title',
    )
    const offer = (payload.attributes.purchasable_offer as Array<{
      our_price: Array<{ schedule: Array<{ value_with_tax: number }> }>
    }>)[0]
    expect(offer.our_price[0].schedule[0].value_with_tax).toBe(12.5)
  })

  it('omits identifier, image, and weight attributes when unknown', () => {
    const payload = buildAmazonListingPayload(
      makeAmazonProduct({ gtin: null, images: [], featuredImage: null, weightOz: null }),
      {},
      MARKETPLACE,
    )
    expect(payload.attributes.externally_assigned_product_identifier).toBeUndefined()
    expect(payload.attributes.main_product_image_locator).toBeUndefined()
    expect(payload.attributes.item_package_weight).toBeUndefined()
  })

  it('clamps negative inventory to zero', () => {
    const payload = buildAmazonListingPayload(
      makeAmazonProduct({ inventory: -3 }),
      {},
      MARKETPLACE,
    )
    expect(
      (payload.attributes.fulfillment_availability as Array<{ quantity: number }>)[0].quantity,
    ).toBe(0)
  })
})

describe('buildGoogleShoppingProduct', () => {
  it('maps the product onto a Merchant API product input', () => {
    const input = buildGoogleShoppingProduct(makeGoogleProduct(), {})
    const attrs = input.productAttributes

    expect(input.offerId).toBe('SALSA-001')
    expect(input.contentLanguage).toBe('en')
    expect(input.feedLabel).toBe('US')
    expect(attrs.price).toEqual({ amountMicros: '9990000', currencyCode: 'USD' })
    expect(attrs.salePrice).toBeUndefined()
    expect(attrs.gtins).toEqual(['012345678905'])
    expect(attrs.identifierExists).toBeUndefined()
    expect(attrs.availability).toBe('IN_STOCK')
    expect(attrs.condition).toBe('NEW')
    expect(attrs.imageLink).toBe('https://example.com/a.jpg')
    expect(attrs.additionalImageLinks).toEqual(['https://example.com/b.jpg'])
    expect(attrs.shippingWeight).toEqual({ value: 16, unit: 'oz' })
  })

  it('splits regular and sale price when discounted', () => {
    const { productAttributes: attrs } = buildGoogleShoppingProduct(
      makeGoogleProduct({ price: 9.99, compareAtPrice: 12.99 }),
      {},
    )
    expect(attrs.price).toEqual({ amountMicros: '12990000', currencyCode: 'USD' })
    expect(attrs.salePrice).toEqual({ amountMicros: '9990000', currencyCode: 'USD' })
  })

  it('declares identifierExists=false without a GTIN and out of stock at zero inventory', () => {
    const { productAttributes: attrs } = buildGoogleShoppingProduct(
      makeGoogleProduct({ gtin: null, inventory: 0 }),
      {},
    )
    expect(attrs.gtins).toBeUndefined()
    expect(attrs.identifierExists).toBe(false)
    expect(attrs.availability).toBe('OUT_OF_STOCK')
  })

  it('applies overrides for title, price, and availability', () => {
    const { productAttributes: attrs } = buildGoogleShoppingProduct(makeGoogleProduct(), {
      title: 'Custom Title',
      price: 11,
      availability: 'preorder',
    })
    expect(attrs.title).toBe('Custom Title')
    expect(attrs.price).toEqual({ amountMicros: '11000000', currencyCode: 'USD' })
    expect(attrs.availability).toBe('PREORDER')
  })
})
