import { describe, expect, it } from 'vitest'

import {
  DESCRIPTION_SUFFIX,
  buildFeedDescription,
  buildFeedItem,
  buildFeedTitle,
  buildFeedXml,
  feedSkipReasons,
  xmlEscape,
  type MerchantFeedProduct,
} from '@/lib/merchant-center-feed'

const SITE = 'https://www.josemadridsalsa.com'

function product(overrides: Partial<MerchantFeedProduct> = {}): MerchantFeedProduct {
  return {
    name: 'Mango Habanero',
    slug: 'mango-habanero',
    sku: 'JMS-HOT-004',
    price: 9,
    barcode: '093662452973',
    description: 'Sweet mango with a habanero kick.',
    metaDescription: null,
    heatLevel: 'FRUIT',
    featuredImage: '/images/products/mango-habanero.jpg',
    images: ['/images/products/mango-habanero.jpg', 'https://cdn.example.com/mango-2.jpg'],
    inventory: 24,
    weight: 16,
    category: { name: 'Fruit Hot Salsa', slug: 'fruit-hot-salsa' },
    ...overrides,
  }
}

describe('buildFeedTitle', () => {
  it('fills the template with flavor, heat and jar size', () => {
    expect(buildFeedTitle(product())).toBe(
      'Jose Madrid Mango Habanero Salsa - Hot Heat - Small Batch Gourmet Salsa - 16 oz Jar'
    )
  })

  it('strips the brand and "Salsa" already in the product name', () => {
    expect(buildFeedTitle(product({ name: 'Jose Madrid Garden Fresh Cilantro Salsa Mild' }))).toMatch(
      /^Jose Madrid Garden Fresh Cilantro Mild Salsa - /
    )
    expect(buildFeedTitle(product({ name: 'Roasted Garlic &amp; Olives' }))).toMatch(
      /^Jose Madrid Roasted Garlic & Olives Salsa - /
    )
  })

  it('falls back to the heat level when the category is not a salsa category', () => {
    const title = buildFeedTitle(product({ heatLevel: 'EXTRA_HOT', category: { name: 'Salsa', slug: 'salsa' } }))
    expect(title).toContain(' - Extra Hot Heat - ')
  })

  it('leaves out heat and size when they are unknown', () => {
    expect(buildFeedTitle(product({ heatLevel: 'FRUIT', category: null, weight: null }))).toBe(
      'Jose Madrid Mango Habanero Salsa - Small Batch Gourmet Salsa'
    )
  })

  it('caps the title at 150 characters without splitting a word', () => {
    const title = buildFeedTitle(product({ name: 'Extraordinarily '.repeat(12) + 'Long' }))
    expect(title.length).toBeLessThanOrEqual(150)
    expect(title).toMatch(/Extraordinarily$/)
  })
})

describe('buildFeedDescription', () => {
  it('pads a short description with the small-batch suffix', () => {
    expect(buildFeedDescription(product())).toBe(`Sweet mango with a habanero kick. ${DESCRIPTION_SUFFIX}`)
  })

  it('uses the meta description when there is no description, and the suffix alone when neither exists', () => {
    expect(buildFeedDescription({ description: null, metaDescription: 'Meta copy.' })).toBe(
      `Meta copy. ${DESCRIPTION_SUFFIX}`
    )
    expect(buildFeedDescription({ description: null, metaDescription: null })).toBe(DESCRIPTION_SUFFIX)
  })

  it('leaves a description of 500+ characters unpadded', () => {
    const long = 'Fresh salsa. '.repeat(40).trim()
    expect(long.length).toBeGreaterThanOrEqual(500)
    expect(buildFeedDescription({ description: long, metaDescription: null })).toBe(long)
  })

  it('caps at 1000 characters', () => {
    const huge = 'word '.repeat(400)
    expect(buildFeedDescription({ description: huge, metaDescription: null }).length).toBeLessThanOrEqual(1000)
  })

  it('strips HTML from imported copy', () => {
    expect(buildFeedDescription({ description: '<p>Chunky&nbsp;&amp; bold</p>', metaDescription: null })).toMatch(
      /^Chunky & bold /
    )
  })
})

describe('xmlEscape', () => {
  it('escapes all five XML special characters', () => {
    expect(xmlEscape(`Salt & "Lime" <Hot> 'n' more`)).toBe(
      'Salt &amp; &quot;Lime&quot; &lt;Hot&gt; &apos;n&apos; more'
    )
  })

  it('escapes text inside a built item', () => {
    const item = buildFeedItem(product({ name: 'Roasted Garlic & Olives', description: 'Garlic "and" olives, 2 > 1' }), SITE)
    expect(item).toContain('Roasted Garlic &amp; Olives Salsa')
    expect(item).toContain('Garlic &quot;and&quot; olives, 2 &gt; 1')
  })
})

describe('feedSkipReasons', () => {
  it('passes a complete product', () => {
    expect(feedSkipReasons(product())).toEqual([])
  })

  it('names every missing field', () => {
    expect(
      feedSkipReasons(product({ slug: '', price: null, barcode: null, featuredImage: null, images: [] }))
    ).toEqual(['no slug', 'no price', 'no barcode (GTIN)', 'no image'])
  })

  it('rejects a barcode that is not a GTIN', () => {
    expect(feedSkipReasons(product({ barcode: 'JMS-1' }))).toEqual(['barcode "JMS-1" is not a GTIN'])
  })
})

describe('buildFeedItem', () => {
  it('maps zero inventory to out of stock', () => {
    expect(buildFeedItem(product({ inventory: 0 }), SITE)).toContain('<g:availability>out of stock</g:availability>')
  })

  it('caps additional images at 10', () => {
    const images = Array.from({ length: 15 }, (_, i) => `/images/extra-${i}.jpg`)
    const item = buildFeedItem(product({ images }), SITE)
    expect(item.match(/<g:additional_image_link>/g)).toHaveLength(10)
  })

  it('builds a complete item', () => {
    expect(buildFeedItem(product(), SITE)).toBe(
      [
        '    <item>',
        '      <g:id>JMS-HOT-004</g:id>',
        '      <g:title>Jose Madrid Mango Habanero Salsa - Hot Heat - Small Batch Gourmet Salsa - 16 oz Jar</g:title>',
        `      <g:description>Sweet mango with a habanero kick. ${xmlEscape(DESCRIPTION_SUFFIX)}</g:description>`,
        '      <g:link>https://www.josemadridsalsa.com/products/mango-habanero</g:link>',
        '      <g:image_link>https://www.josemadridsalsa.com/images/products/mango-habanero.jpg</g:image_link>',
        '      <g:additional_image_link>https://cdn.example.com/mango-2.jpg</g:additional_image_link>',
        '      <g:availability>in stock</g:availability>',
        '      <g:price>9.00 USD</g:price>',
        '      <g:brand>Jose Madrid Salsa</g:brand>',
        '      <g:condition>new</g:condition>',
        '      <g:gtin>093662452973</g:gtin>',
        '      <g:google_product_category>1702</g:google_product_category>',
        '      <g:product_type>Fruit Hot</g:product_type>',
        '      <g:custom_label_0>Hot</g:custom_label_0>',
        '    </item>',
      ].join('\n')
    )
  })
})

describe('buildFeedXml', () => {
  it('wraps items in an RSS 2.0 document with the g namespace', () => {
    const xml = buildFeedXml([buildFeedItem(product(), SITE)], SITE)
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss xmlns:g="http:\/\/base.google.com\/ns\/1.0" version="2.0">/)
    expect(xml.match(/<item>/g)).toHaveLength(1)
    expect(xml.trimEnd()).toMatch(/<\/channel>\n<\/rss>$/)
  })
})
