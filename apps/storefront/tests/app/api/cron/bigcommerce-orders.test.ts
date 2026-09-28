import { beforeEach, describe, expect, it, vi } from 'vitest'

const syncBigCommerceOrders = vi.fn()
const isBigCommerceStorefrontEnabled = vi.fn()
const isBigCommerceConfigured = vi.fn()

vi.mock('@/lib/cron/auth', () => ({ isAuthorizedCronRequest: () => true }))
vi.mock('@/lib/bigcommerce/orders', () => ({ syncBigCommerceOrders }))
vi.mock('@/lib/bigcommerce/storefront', () => ({ isBigCommerceStorefrontEnabled }))
vi.mock('@/lib/bigcommerce/config', () => ({ isBigCommerceConfigured }))

const { GET } = await import('@/app/api/cron/bigcommerce-orders/route')

const tally = { created: 1, updated: 0, skipped: 0, failed: 0 }
const run = async () => (await GET(new Request('http://localhost/api/cron/bigcommerce-orders'))).json()

beforeEach(() => {
  syncBigCommerceOrders.mockReset().mockResolvedValue(tally)
  isBigCommerceConfigured.mockReset()
  isBigCommerceStorefrontEnabled.mockReset()
})

describe('GET /api/cron/bigcommerce-orders', () => {
  it('sweeps both stores when retail sells through BigCommerce and the fundraising store is configured', async () => {
    isBigCommerceStorefrontEnabled.mockReturnValue(true)
    isBigCommerceConfigured.mockReturnValue(true)

    expect(await run()).toEqual({ ...tally, fundraising: tally })
    expect(syncBigCommerceOrders).toHaveBeenCalledTimes(2)
    expect(syncBigCommerceOrders.mock.calls[1][2]).toBe('fundraising')
  })

  it('sweeps the fundraising store even before retail switches over', async () => {
    isBigCommerceStorefrontEnabled.mockReturnValue(false)
    isBigCommerceConfigured.mockReturnValue(true)

    const body = await run()
    expect(body.fundraising).toEqual(tally)
    expect(syncBigCommerceOrders).toHaveBeenCalledTimes(1)
    expect(syncBigCommerceOrders.mock.calls[0][2]).toBe('fundraising')
  })

  it('does nothing when neither store is in use', async () => {
    isBigCommerceStorefrontEnabled.mockReturnValue(false)
    isBigCommerceConfigured.mockReturnValue(false)

    expect((await run()).skipped).toBeTruthy()
    expect(syncBigCommerceOrders).not.toHaveBeenCalled()
  })
})
