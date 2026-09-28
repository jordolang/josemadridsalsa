import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BigCommerceProduct } from '@/lib/bigcommerce/catalog'

const fetchMock = vi.fn()
const productsMock = vi.fn()

vi.mock('@/lib/bigcommerce/client', () => ({
  bigCommerceFetch: (...args: unknown[]) => fetchMock(...args),
}))
vi.mock('@/lib/bigcommerce/catalog', () => ({
  getBigCommerceProducts: (...args: unknown[]) => productsMock(...args),
}))

import { BigCommerceCartError } from '@/lib/bigcommerce/cart'
import {
  findGroupOption,
  normalizeGroupName,
  parseFundraisingCheckoutFields,
} from '@/lib/fundraising-site/checkout-fields'
import {
  buildFundraisingLineItems,
  createFundraisingCheckout,
  fundraisingCheckoutRequestSchema,
} from '@/lib/fundraising-site/checkout'

function product(overrides: Partial<BigCommerceProduct>): BigCommerceProduct {
  return {
    id: 112,
    name: 'Original Mild Salsa',
    legacyPath: '/original-mild-salsa/',
    siteSlug: null,
    descriptionHtml: '',
    price: 10,
    compareAtPrice: null,
    isVisible: true,
    isFeatured: false,
    isPurchasable: true,
    inventoryTracked: false,
    inventoryLevel: null,
    minQuantity: 1,
    maxQuantity: null,
    categoryIds: [23],
    sortOrder: 0,
    images: [],
    modifiers: [],
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  }
}

// The shape the storefront's /api/storefront/form-fields endpoint returns.
const FORM_FIELDS = {
  billingAddress: [
    { id: 'field_4', custom: false, label: 'First Name' },
    {
      id: 'field_26',
      custom: true,
      label: 'Fundraising Group name ',
      fieldType: 'dropdown',
      options: {
        items: [
          { value: '0', label: '4Star Horsemanship 4-H Spring 2026' },
          { value: '1', label: 'Leavenworth Soccer Association' },
        ],
      },
    },
    { id: 'field_28', custom: true, label: 'Salesperson', fieldType: 'text' },
  ],
}

describe('parseFundraisingCheckoutFields', () => {
  it('finds the group dropdown and salesperson field', () => {
    expect(parseFundraisingCheckoutFields(FORM_FIELDS)).toEqual({
      groupFieldId: 'field_26',
      sellerFieldId: 'field_28',
      groups: [
        { value: '0', label: '4Star Horsemanship 4-H Spring 2026' },
        { value: '1', label: 'Leavenworth Soccer Association' },
      ],
    })
  })

  it('recognises the older field labels', () => {
    const parsed = parseFundraisingCheckoutFields({
      billingAddress: [
        { id: 'field_20', custom: true, label: 'Fundraiser Group', options: { items: [{ value: '0', label: 'A' }] } },
        { id: 'field_21', custom: true, label: 'Sales Person' },
      ],
    })
    expect(parsed?.groupFieldId).toBe('field_20')
    expect(parsed?.sellerFieldId).toBe('field_21')
  })

  it('returns null when there is no group field', () => {
    expect(parseFundraisingCheckoutFields({ billingAddress: [FORM_FIELDS.billingAddress[0]] })).toBeNull()
    expect(parseFundraisingCheckoutFields(null)).toBeNull()
  })
})

describe('group matching', () => {
  it('ignores case, spacing and curly apostrophes', () => {
    expect(normalizeGroupName('  Chelsea Children’s  Co-op ')).toBe(normalizeGroupName("chelsea children's co-op"))
  })

  it('keeps seasons apart', () => {
    expect(normalizeGroupName('SRU Marching Pride Fall 2023')).not.toBe(normalizeGroupName('SRU Marching Pride'))
  })

  it('finds a listed group loosely and refuses an unlisted one', () => {
    const groups = parseFundraisingCheckoutFields(FORM_FIELDS)!.groups
    expect(findGroupOption(groups, 'leavenworth soccer association')?.value).toBe('1')
    expect(findGroupOption(groups, 'Some Other Club')).toBeNull()
  })
})

describe('buildFundraisingLineItems', () => {
  it('merges repeated products', () => {
    const items = buildFundraisingLineItems(
      [
        { productId: 112, quantity: 2 },
        { productId: 112, quantity: 3 },
        { productId: 113, quantity: 1 },
      ],
      [product({}), product({ id: 113, name: 'Clovis Medium' })],
    )
    expect(items).toEqual([
      { product_id: 112, quantity: 5 },
      { product_id: 113, quantity: 1 },
    ])
  })

  it('refuses hidden or unknown products', () => {
    expect(() => buildFundraisingLineItems([{ productId: 999, quantity: 1 }], [product({})])).toThrow(BigCommerceCartError)
    expect(() =>
      buildFundraisingLineItems([{ productId: 139, quantity: 1 }], [product({ id: 139, name: 'Pumpkin', isPurchasable: false })]),
    ).toThrow(/Pumpkin is not available/)
  })
})

describe('fundraisingCheckoutRequestSchema', () => {
  it('requires a group and a salesperson', () => {
    const base = { items: [{ productId: 112, quantity: 1 }], group: 'A', seller: 'Sam' }
    expect(fundraisingCheckoutRequestSchema.safeParse(base).success).toBe(true)
    expect(fundraisingCheckoutRequestSchema.safeParse({ ...base, group: '  ' }).success).toBe(false)
    expect(fundraisingCheckoutRequestSchema.safeParse({ ...base, seller: '' }).success).toBe(false)
    expect(fundraisingCheckoutRequestSchema.safeParse({ ...base, items: [] }).success).toBe(false)
  })
})

describe('createFundraisingCheckout', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    productsMock.mockReset().mockResolvedValue([product({})])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(FORM_FIELDS), { status: 200 })),
    )
  })

  const request = { items: [{ productId: 112, quantity: 4 }], group: 'Leavenworth Soccer Association', seller: 'Sam Smith' }

  it('creates a fundraising-store cart and pre-fills group and salesperson', async () => {
    fetchMock.mockImplementation(async (_store: string, path: string) =>
      path === 'v3/carts'
        ? { data: { id: 'cart-1', redirect_urls: { checkout_url: 'https://josemadridsalsafundraising.com/cart.php?action=loadInCheckout&id=cart-1' } } }
        : { data: {} },
    )

    const result = await createFundraisingCheckout(request)

    expect(result).toEqual({
      cartId: 'cart-1',
      checkoutUrl: 'https://josemadridsalsafundraising.com/cart.php?action=loadInCheckout&id=cart-1',
      prefilled: true,
    })
    expect(productsMock).toHaveBeenCalledWith('fundraising')
    expect(fetchMock).toHaveBeenCalledWith('fundraising', 'v3/carts', expect.objectContaining({
      method: 'POST',
      body: { channel_id: 1, line_items: [{ product_id: 112, quantity: 4 }] },
    }))
    expect(fetchMock).toHaveBeenCalledWith('fundraising', 'v3/checkouts/cart-1/billing-address', {
      method: 'POST',
      body: {
        country_code: 'US',
        custom_fields: [
          { field_id: 'field_26', field_value: '1' },
          { field_id: 'field_28', field_value: 'Sam Smith' },
        ],
      },
    })
  })

  it('still returns the checkout when the pre-fill is rejected', async () => {
    fetchMock.mockImplementation(async (_store: string, path: string) => {
      if (path === 'v3/carts') return { data: { id: 'cart-2', redirect_urls: { checkout_url: 'https://x/checkout' } } }
      throw new Error('422')
    })

    await expect(createFundraisingCheckout(request)).resolves.toMatchObject({ checkoutUrl: 'https://x/checkout', prefilled: false })
  })

  it('refuses a group that is not in the checkout dropdown, before creating a cart', async () => {
    await expect(createFundraisingCheckout({ ...request, group: 'Unknown Club' })).rejects.toBeInstanceOf(BigCommerceCartError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
