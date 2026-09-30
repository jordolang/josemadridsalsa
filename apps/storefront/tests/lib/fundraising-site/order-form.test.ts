import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

vi.mock('server-only', () => ({}))
import {
  ORDER_FORM_CATEGORIES,
  ORDER_FORM_FLAVORS,
  ORDER_FORM_MAX_PER_FLAVOR,
  clampJarCount,
  computeOrderFormTotals,
  formatOrderFormCents,
  orderFormAgreementText,
  orderFormSubmissionSchema,
  type OrderFormSubmissionInput,
} from '@/lib/fundraising-site/order-form'
import {
  buildOrderFormEmail,
  buildOrderFormPathname,
  buildOrderFormPdf,
  createOrderFormRecord,
  orderFormCode,
  orderFormLineItems,
} from '@/lib/fundraising-site/order-form-submission'

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGNgYGD4D8UQBgAd9AP9yOH2qAAAAABJRU5ErkJggg=='

function validInput(overrides: Partial<OrderFormSubmissionInput> = {}): OrderFormSubmissionInput {
  return {
    organizationName: 'Lincoln Elementary PTO',
    contactName: 'Pat Smith',
    email: ' Pat@Example.com ',
    phone: '740-555-0123',
    shipTo: { name: 'Pat Smith', street: '1 Main St', city: 'Zanesville', state: 'OH', postalCode: '43701' },
    notes: '',
    quantities: { 'raspberry-mild': 12, 'original-hot': 3, 'chipotle-hot': 0 },
    agreed: true,
    signature: SIGNATURE,
    ...overrides,
  }
}

describe('order form catalog', () => {
  it('matches the 25 flavor paper form in four sections', () => {
    expect(ORDER_FORM_FLAVORS).toHaveLength(25)
    expect(ORDER_FORM_CATEGORIES.map((category) => [category.label, category.flavors.length])).toEqual([
      ['Fruit', 9],
      ['Specialty', 8],
      ['Verdes', 3],
      ['Originals', 5],
    ])
    expect(new Set(ORDER_FORM_FLAVORS.map((flavor) => flavor.id)).size).toBe(25)
  })
})

describe('clampJarCount', () => {
  it('keeps counts whole and in range', () => {
    expect(clampJarCount(-1)).toBe(0)
    expect(clampJarCount(2.9)).toBe(2)
    expect(clampJarCount(Number.NaN)).toBe(0)
    expect(clampJarCount(ORDER_FORM_MAX_PER_FLAVOR + 50)).toBe(ORDER_FORM_MAX_PER_FLAVOR)
  })
})

describe('computeOrderFormTotals', () => {
  it('prices every jar at $10 with $5 due and $5 profit', () => {
    const totals = computeOrderFormTotals({ 'raspberry-mild': 12, 'original-hot': 3 })
    expect(totals.totalJars).toBe(15)
    expect(totals.retailCents).toBe(15_000)
    expect(totals.dueCents).toBe(7_500)
    expect(totals.profitCents).toBe(7_500)
    expect(totals.categoryJars).toEqual({ fruit: 12, specialty: 0, verdes: 0, originals: 3 })
  })

  it('tracks progress to free shipping at 96 jars', () => {
    expect(computeOrderFormTotals({ 'mango-mild': 95 })).toMatchObject({ freeShipping: false, jarsToFreeShipping: 1 })
    expect(computeOrderFormTotals({ 'mango-mild': 96 })).toMatchObject({ freeShipping: true, jarsToFreeShipping: 0 })
  })

  it('ignores unknown flavors and bad counts', () => {
    expect(computeOrderFormTotals({ 'not-a-flavor': 40, 'peach-mild': -3 }).totalJars).toBe(0)
  })
})

describe('orderFormAgreementText', () => {
  it('states the jar count and amount due', () => {
    expect(orderFormAgreementText({ totalJars: 1, dueCents: 500 })).toContain('order of 1 jar is accurate')
    expect(orderFormAgreementText({ totalJars: 20, dueCents: 10_000 })).toContain(`pay Jose Madrid Salsa ${formatOrderFormCents(10_000)}`)
  })
})

describe('orderFormSubmissionSchema', () => {
  it('accepts a complete signed order and drops zero-jar flavors', () => {
    const parsed = orderFormSubmissionSchema.parse(validInput())
    expect(parsed.email).toBe('pat@example.com')
    expect(parsed.notes).toBeUndefined()
    expect(parsed.quantities).toEqual({ 'raspberry-mild': 12, 'original-hot': 3 })
  })

  it('requires the confirmation checkbox', () => {
    const result = orderFormSubmissionSchema.safeParse({ ...validInput(), agreed: false })
    expect(result.success).toBe(false)
  })

  it('requires a drawn signature', () => {
    expect(orderFormSubmissionSchema.safeParse(validInput({ signature: '' })).success).toBe(false)
    expect(orderFormSubmissionSchema.safeParse(validInput({ signature: 'data:image/jpeg;base64,AAAA' })).success).toBe(false)
  })

  it('requires at least one jar', () => {
    const result = orderFormSubmissionSchema.safeParse(validInput({ quantities: { 'raspberry-mild': 0 } }))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.flatten().fieldErrors.quantities).toContain('Add at least one jar to the order')
  })

  it('rejects unknown flavors, fractional jars and bad contact details', () => {
    expect(orderFormSubmissionSchema.safeParse(validInput({ quantities: { bogus: 2 } })).success).toBe(false)
    expect(orderFormSubmissionSchema.safeParse(validInput({ quantities: { 'raspberry-mild': 1.5 } })).success).toBe(false)
    expect(orderFormSubmissionSchema.safeParse(validInput({ phone: '555-0123' })).success).toBe(false)
    expect(orderFormSubmissionSchema.safeParse(validInput({ email: 'nope' })).success).toBe(false)
    expect(
      orderFormSubmissionSchema.safeParse(validInput({ shipTo: { ...validInput().shipTo, postalCode: '4370' } })).success,
    ).toBe(false)
  })
})

describe('order form record', () => {
  const submission = orderFormSubmissionSchema.parse(validInput({ notes: 'Deliver to the front office' }))
  const record = createOrderFormRecord(submission, {
    id: '1a2b3c4d-0000-4000-8000-000000000000',
    now: new Date('2026-09-30T15:30:00Z'),
    ipAddress: '203.0.113.9',
  })

  it('carries a short reference, the totals and the agreement signed', () => {
    expect(orderFormCode('1a2b3c4d-0000')).toBe('FO-1A2B3C')
    expect(record.code).toBe('FO-1A2B3C')
    expect(record.totals.dueCents).toBe(7_500)
    expect(record.agreementText).toBe(orderFormAgreementText(record.totals))
  })

  it('files the PDF by Eastern date and organization', () => {
    expect(buildOrderFormPathname(record)).toBe(
      'fundraising/order-forms/2026/09/2026-09-30-lincoln-elementary-pto-fo-1a2b3c',
    )
  })

  it('lists only ordered flavors as line items', () => {
    expect(orderFormLineItems(record)).toEqual([
      { category: 'Fruit', label: 'Raspberry - Mild', jars: 12, retailCents: 12_000 },
      { category: 'Originals', label: 'Original - Hot', jars: 3, retailCents: 3_000 },
    ])
  })

  it('renders a signed PDF', async () => {
    const bytes = await buildOrderFormPdf(record)
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(pdf.getTitle()).toBe('Fundraiser Order Form - Lincoln Elementary PTO')
  })

  it('escapes user text in emails and gives the group payment instructions', () => {
    const hostile = createOrderFormRecord(
      orderFormSubmissionSchema.parse(validInput({ organizationName: '<script>alert(1)</script>' })),
    )
    const staff = buildOrderFormEmail(hostile, { audience: 'staff', pdfUrl: null })
    expect(staff.html).not.toContain('<script>')
    expect(staff.subject).toContain('15 jars')

    const copy = buildOrderFormEmail(record, { audience: 'submitter', pdfUrl: 'https://blob.example/x.pdf' })
    expect(copy.text).toContain('Amount due: $75.00')
    expect(copy.text).toContain('P.O. Box 1061')
    expect(copy.html).toContain('https://blob.example/x.pdf')
  })
})
