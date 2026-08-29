import { describe, expect, it } from 'vitest'

import {
  BROCHURE_LABELS,
  BROCHURE_OPTIONS,
  FULFILLMENT_LABELS,
  FULFILLMENT_OPTIONS,
  ONLINE_LINK_NOTE,
  ONLINE_STORE_ALWAYS_AVAILABLE,
  collectsOrderForms,
  needsBrochureChoice,
  needsResaleCertificate,
  resolveFulfillmentTerms,
} from '@/lib/fundraising/fulfillment'

describe('fulfillment methods', () => {
  it('treats collecting order forms as the classic drive', () => {
    expect(collectsOrderForms('ORDER_FORMS_AND_BULK')).toBe(true)
    expect(collectsOrderForms('ONLINE_ONLY')).toBe(false)
  })

  it('never closes the online store, whichever method is chosen', () => {
    // The point most easily lost when someone later reads ONLINE_ONLY and assumes its
    // opposite must turn the store off. It does not — a supporter who would rather not fill
    // in a paper form still needs somewhere to buy.
    expect(ONLINE_STORE_ALWAYS_AVAILABLE).toBe(true)
    expect(ONLINE_LINK_NOTE).toContain('either way')
  })

  it('asks for brochures and a resale certificate only where they apply', () => {
    // An online-only campaign has nothing to print and makes no wholesale purchase, so both
    // questions would be noise.
    expect(needsBrochureChoice('ORDER_FORMS_AND_BULK')).toBe(true)
    expect(needsBrochureChoice('ONLINE_ONLY')).toBe(false)
    expect(needsResaleCertificate('ORDER_FORMS_AND_BULK')).toBe(true)
    expect(needsResaleCertificate('ONLINE_ONLY')).toBe(false)
  })

  it('recommends exactly one option, and it is the paper drive', () => {
    const recommended = FULFILLMENT_OPTIONS.filter((o) => o.recommended)
    expect(recommended).toHaveLength(1)
    expect(recommended[0].value).toBe('ORDER_FORMS_AND_BULK')
  })

  it('offers copy for every method and brochure option', () => {
    // A missing entry would render an option with no explanation next to one that has three
    // paragraphs, which reads as the unexplained one being the lesser choice.
    for (const method of Object.keys(FULFILLMENT_LABELS)) {
      expect(FULFILLMENT_OPTIONS.some((o) => o.value === method)).toBe(true)
    }
    for (const option of Object.keys(BROCHURE_LABELS)) {
      expect(BROCHURE_OPTIONS.some((o) => o.value === option)).toBe(true)
    }
  })

  it('tells a group collecting forms that they owe us, and that the tax is theirs', () => {
    // The two facts a coordinator must not reach the end of a drive without knowing.
    const paper = FULFILLMENT_OPTIONS.find((o) => o.value === 'ORDER_FORMS_AND_BULK')!
    const body = paper.body.join(' ')
    expect(body).toContain('invoice you')
    expect(body).toMatch(/sales tax on those orders is yours/i)
    expect(body).toContain('resale certificate')
  })

  it('tells an online-only group they will have no records of their own', () => {
    const online = FULFILLMENT_OPTIONS.find((o) => o.value === 'ONLINE_ONLY')!
    expect(online.tradeOff).toMatch(/no records of your own/i)
    expect(online.tradeOff).toMatch(/dashboard/i)
  })

  it('warns a paper group that it is more work before they pick it', () => {
    const paper = FULFILLMENT_OPTIONS.find((o) => o.value === 'ORDER_FORMS_AND_BULK')!
    expect(paper.tradeOff).toMatch(/more work/i)
  })

  it('promises an online order will not land in the bulk delivery', () => {
    // What keeps a coordinator's own paperwork balancing against what they were sent.
    expect(ONLINE_LINK_NOTE).toMatch(/not turn up in your bulk delivery/i)
  })
})

describe('resolveFulfillmentTerms', () => {
  it('lets the admin override what the school asked for', () => {
    // The person clicking approve is usually the one who just had the phone call.
    const terms = resolveFulfillmentTerms({
      adminChoice: { method: 'ONLINE_ONLY' },
      request: { requestedFulfillment: 'ORDER_FORMS_AND_BULK', requestedBrochure: 'PROFESSIONAL_100' },
    })

    expect(terms.fulfillmentMethod).toBe('ONLINE_ONLY')
  })

  it("falls back to the school's request when the admin changed nothing", () => {
    const terms = resolveFulfillmentTerms({
      adminChoice: {},
      request: { requestedFulfillment: 'ONLINE_ONLY' },
    })

    expect(terms.fulfillmentMethod).toBe('ONLINE_ONLY')
  })

  it('defaults to collecting order forms when nobody said', () => {
    // An application filed before the question existed, approved by an admin who did not
    // touch the field. The classic drive is the right landing place.
    expect(resolveFulfillmentTerms({ request: null }).fulfillmentMethod).toBe('ORDER_FORMS_AND_BULK')
    expect(resolveFulfillmentTerms({}).fulfillmentMethod).toBe('ORDER_FORMS_AND_BULK')
  })

  it('clears brochures and the certificate on an online-only campaign', () => {
    // Carrying either would describe something that never happens on that campaign.
    const terms = resolveFulfillmentTerms({
      adminChoice: { method: 'ONLINE_ONLY' },
      request: { requestedBrochure: 'PROFESSIONAL_100', resaleNumber: 'OH-12345' },
    })

    expect(terms.brochureOption).toBeNull()
    expect(terms.resaleNumber).toBeNull()
  })

  it('lands on the free brochure option when nobody chose one', () => {
    // Defaulting to the paid set would bill a group for something they never asked for.
    const terms = resolveFulfillmentTerms({ request: { requestedFulfillment: 'ORDER_FORMS_AND_BULK' } })

    expect(terms.brochureOption).toBe('PRINT_YOUR_OWN')
  })

  it('carries the resale certificate through from the application', () => {
    const terms = resolveFulfillmentTerms({
      request: { requestedFulfillment: 'ORDER_FORMS_AND_BULK', resaleNumber: 'OH-12345' },
    })

    expect(terms.resaleNumber).toBe('OH-12345')
  })

  it('lets the admin correct a certificate typed wrong on the application', () => {
    const terms = resolveFulfillmentTerms({
      adminChoice: { resaleNumber: 'OH-99999' },
      request: { requestedFulfillment: 'ORDER_FORMS_AND_BULK', resaleNumber: 'OH-12345' },
    })

    expect(terms.resaleNumber).toBe('OH-99999')
  })
})
