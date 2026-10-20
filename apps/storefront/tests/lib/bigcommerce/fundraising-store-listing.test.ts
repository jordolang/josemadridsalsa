import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.hoisted(() => vi.fn())
const sendEmail = vi.hoisted(() => vi.fn())
const linkSiteFundraiser = vi.hoisted(() => vi.fn())
const getFundraisingCheckoutFields = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: { fundraiser: { findMany } } }))
vi.mock('@/lib/email', () => ({ sendEmail }))
vi.mock('@/lib/bigcommerce/fundraising-orders', () => ({
  BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL: 'fundraising@josemadridsalsa.com',
  linkSiteFundraiser,
}))
vi.mock('@/lib/fundraising-site/checkout-fields', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fundraising-site/checkout-fields')>()),
  getFundraisingCheckoutFields,
}))

import { syncSiteFundraisersToStore } from '@/lib/bigcommerce/fundraising-store-listing'

const NOW = new Date('2026-10-20T13:00:00Z')

describe('syncSiteFundraisersToStore', () => {
  beforeEach(() => {
    for (const fn of [findMany, sendEmail, linkSiteFundraiser, getFundraisingCheckoutFields]) fn.mockReset()
    getFundraisingCheckoutFields.mockResolvedValue({
      groupFieldId: 'field_1',
      sellerFieldId: null,
      groups: [{ value: '0', label: 'Creativity Unites/Dance United' }],
    })
    linkSiteFundraiser.mockResolvedValue('f-1')
  })

  it('looks only at live site fundraisers', async () => {
    findMany.mockResolvedValue([])

    expect(await syncSiteFundraisersToStore(NOW)).toEqual({ linked: 0, missing: 0, unlinkable: 0 })
    expect(findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      status: 'ACTIVE',
      startDate: { lte: NOW },
      endDate: { gte: NOW },
    })
    expect(getFundraisingCheckoutFields).not.toHaveBeenCalled()
  })

  it('links the ones already in the dropdown and emails the names of the rest', async () => {
    findMany.mockResolvedValue([
      { name: 'creativity unites/dance united', bigCommerceGroup: null },
      { name: 'Tri-Valley  Scotties ', bigCommerceGroup: null },
    ])

    expect(await syncSiteFundraisersToStore(NOW)).toEqual({ linked: 1, missing: 1, unlinkable: 0 })
    expect(linkSiteFundraiser).toHaveBeenCalledWith('Creativity Unites/Dance United')
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const email = sendEmail.mock.calls[0][0]
    expect(email.to).toBe('fundraising@josemadridsalsa.com')
    expect(email.subject).toBe('1 fundraiser to fix in the BigCommerce fundraising store')
    expect(email.html).toContain('<strong>Tri-Valley Scotties</strong>')
    expect(email.html).not.toContain('Creativity')
  })

  it('sends nothing when every live fundraiser is listed', async () => {
    findMany.mockResolvedValue([
      { name: 'Creativity Unites/Dance United', bigCommerceGroup: null },
      { name: 'ESBD Boosters', bigCommerceGroup: 'creativity unites/dance united' },
    ])

    await syncSiteFundraisersToStore(NOW)

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('names a linked fundraiser whose dropdown option was removed', async () => {
    findMany.mockResolvedValue([{ name: 'ESBD Boosters', bigCommerceGroup: 'esbd booster club fall 2026' }])

    expect(await syncSiteFundraisersToStore(NOW)).toEqual({ linked: 0, missing: 1, unlinkable: 0 })
    expect(linkSiteFundraiser).not.toHaveBeenCalled()
    expect(sendEmail.mock.calls[0][0].html).toContain('<strong>esbd booster club fall 2026</strong> (for ESBD Boosters)')
  })

  it('asks staff to merge a fundraiser whose group already has its own record', async () => {
    linkSiteFundraiser.mockResolvedValue(null)
    findMany.mockResolvedValue([{ name: 'Creativity Unites/Dance United', bigCommerceGroup: null }])

    expect(await syncSiteFundraisersToStore(NOW)).toEqual({ linked: 0, missing: 0, unlinkable: 1 })
    const email = sendEmail.mock.calls[0][0]
    expect(email.html).toContain('needs merging by hand')
    expect(email.html).toContain('<strong>Creativity Unites/Dance United</strong>')
  })
})
