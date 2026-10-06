import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bigCommerceFetch } from '@/lib/bigcommerce/client'
import { FUNDRAISING_PRODUCT_IDS, createOrderPaymentCheckout } from '@/lib/fundraising-site/order-checkout'
import { ORDER_KITS, type OrderSubmission } from '@/lib/fundraising-site/order-submission'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/bigcommerce/client', () => ({ bigCommerceFetch: vi.fn() }))
vi.mock('@/lib/fundraising-site/checkout-fields', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fundraising-site/checkout-fields')>()),
  getFundraisingCheckoutFields: vi.fn(async () => ({
    groupFieldId: 'field_26',
    sellerFieldId: 'field_28',
    groups: [{ value: '11', label: 'Lower Dauphin Band Boosters' }],
  })),
}))

const order = {
  kit: '16',
  organizationName: 'LDBB',
  contactName: 'Pat Smith',
  email: 'Pat@Example.com',
  phone: '740-555-1212',
  shipName: 'Lower Dauphin HS',
  shipStreet: '1 Main St',
  shipCity: 'Hummelstown',
  shipState: 'pa',
  shipZip: '17036',
  quantities: { raspberry: 100, 'spanish-verde-xx-hot': 36, peach: 0 },
  paymentMethod: 'card-online',
  group: 'Lower Dauphin Band Boosters',
  confirmFinal: true,
  signature: 'data:image/png;base64,AA==',
} as OrderSubmission

describe('createOrderPaymentCheckout', () => {
  beforeEach(() => {
    vi.mocked(bigCommerceFetch).mockReset().mockImplementation(async (_store, path, options) => {
      if (path === 'v3/carts') {
        return {
          data: {
            id: 'cart1',
            redirect_urls: { checkout_url: 'https://store.example/checkout/cart1' },
            line_items: { physical_items: [{ id: 'li1', quantity: 100 }, { id: 'li2', quantity: 36 }] },
          },
        }
      }
      if (path.endsWith('/consignments') && options?.method === 'POST') {
        return { data: { consignments: [{ id: 'con1', available_shipping_options: [{ id: 'flat' }] }] } }
      }
      if (path === 'v3/checkouts/cart1' && !options?.method) return { data: { grand_total: 690 } }
      return null
    })
  })

  it('prices every jar at the group price and pre-fills the group, salesperson and addresses', async () => {
    const result = await createOrderPaymentCheckout(order, 'REF1')
    expect(result).toEqual({ checkoutUrl: 'https://store.example/checkout/cart1', amountDue: 690 })

    const calls = vi.mocked(bigCommerceFetch).mock.calls
    const body = (path: string) => calls.find(([, p]) => p === path)?.[2]?.body as Record<string, unknown>
    expect(body('v3/carts').line_items).toEqual([
      { product_id: 117, quantity: 100, list_price: 5 },
      { product_id: 136, quantity: 36, list_price: 5 },
    ])
    expect(body('v3/checkouts/cart1/billing-address')).toMatchObject({
      first_name: 'Pat',
      last_name: 'Smith',
      email: 'pat@example.com',
      state_or_province_code: 'PA',
      custom_fields: [
        { field_id: 'field_26', field_value: '11' },
        { field_id: 'field_28', field_value: 'Order form – Pat Smith' },
      ],
    })
    expect(body('v3/checkouts/cart1/consignments/con1')).toEqual({ shipping_option_id: 'flat' })
  })

  it('refuses a group the store does not list', async () => {
    await expect(createOrderPaymentCheckout({ ...order, group: 'Nope' }, null)).rejects.toThrow(/not taking online orders/)
    expect(bigCommerceFetch).not.toHaveBeenCalled()
  })

  it('knows a store product for every flavor in every kit', () => {
    for (const kit of Object.values(ORDER_KITS)) {
      for (const flavor of kit.flavors) expect(FUNDRAISING_PRODUCT_IDS[flavor.id], flavor.id).toBeTypeOf('number')
    }
  })
})
