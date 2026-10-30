import { describe, it, expect } from 'vitest'
import {
  addCase,
  caseCount,
  checkoutLines,
  checkoutNote,
  findCaseProduct,
  formatCases,
  isControlCode,
  mergeTaken,
  nextUndated,
  planLines,
  readDateInput,
  removeLastCase,
  setCaseDate,
  type CheckoutProduct,
} from '@/lib/admin-desktop/show-checkout'

const mild: CheckoutProduct = {
  id: 'p1',
  name: 'Mild Salsa',
  sku: 'JMS-MILD-001',
  barcode: '093662452874',
  category: 'Mild',
  unitsPerCase: 12,
}
const verde: CheckoutProduct = { id: 'p2', name: 'Verde Hot', sku: 'JMS-HOT-010', barcode: null, category: 'Hot', unitsPerCase: 12 }
const products = [mild, verde]

describe('findCaseProduct', () => {
  it('matches the jar UPC and the SKU, as the stock scanner does', () => {
    expect(findCaseProduct(products, '093662452874')?.id).toBe('p1')
    expect(findCaseProduct(products, 'jms-hot-010')?.id).toBe('p2')
  })

  it('matches a GTIN-14 case code built from the jar UPC', () => {
    // Packaging digit 1, the jar's GTIN-13 less its check digit, a new check digit.
    expect(findCaseProduct(products, '10093662452871')?.id).toBe('p1')
    expect(findCaseProduct(products, '50093662452879')?.id).toBe('p1')
  })

  it('finds nothing for an unknown code', () => {
    expect(findCaseProduct(products, '10012345678902')).toBeUndefined()
    expect(findCaseProduct(products, 'nope')).toBeUndefined()
  })
})

describe('the cart', () => {
  it('counts a case as one and a half case as a half', () => {
    let cases = addCase([], 'p1', false)
    cases = addCase(cases, 'p1', true)
    cases = addCase(cases, 'p2', false)
    expect(caseCount(cases)).toBe(2.5)
    expect(caseCount(cases, 'p1')).toBe(1.5)
    expect(formatCases(1.5)).toBe('1½')
    expect(formatCases(0.5)).toBe('½')
    expect(formatCases(3)).toBe('3')
  })

  it('takes the last case of a product back off', () => {
    const cases = addCase(addCase(addCase([], 'p1', false), 'p2', false), 'p1', true)
    const after = removeLastCase(cases, 'p1')
    expect(after.map((entry) => entry.seq)).toEqual([1, 2])
    expect(caseCount(after, 'p1')).toBe(1)
  })

  it('dates cases in the order they went on the cart, or the next of a scanned product', () => {
    let cases = addCase(addCase(addCase([], 'p1', false), 'p2', false), 'p1', false)
    expect(nextUndated(cases)?.seq).toBe(1)
    cases = setCaseDate(cases, 1, '2029-02-15')
    expect(nextUndated(cases)?.seq).toBe(2)
    expect(nextUndated(cases, 'p1')?.seq).toBe(3)
  })
})

describe('readDateInput', () => {
  it('fills in the year three years out', () => {
    expect(readDateInput('02/15', '', 2026)).toEqual({ kind: 'date', date: '2029-02-15', label: '02/15/29' })
    expect(readDateInput('2/5', '', 2026)).toMatchObject({ date: '2029-02-05' })
    expect(readDateInput('0215', '', 2026)).toMatchObject({ date: '2029-02-15' })
  })

  it('builds a date from two scans off the code sheet', () => {
    const first = readDateInput('JD02', '', 2026)
    expect(first).toEqual({ kind: 'pending', digits: '02' })
    expect(readDateInput('JD15', '02', 2026)).toMatchObject({ kind: 'date', date: '2029-02-15' })
  })

  it('refuses a date that does not exist in the expiry year', () => {
    expect(readDateInput('13/01', '', 2026).kind).toBe('error')
    expect(readDateInput('02/29', '', 2026).kind).toBe('error') // 2029 is not a leap year
    expect(readDateInput('02/29', '', 2025)).toMatchObject({ date: '2028-02-29' })
    expect(readDateInput('hello', '', 2026).kind).toBe('error')
    expect(readDateInput('02151', '', 2026).kind).toBe('error')
  })
})

describe('isControlCode', () => {
  it('recognises the dates and half-case codes however they are typed', () => {
    expect(isControlCode('JMSDATES')).toBe('dates')
    expect(isControlCode(' jmshalf ')).toBe('half')
    expect(isControlCode('093662452874')).toBeNull()
  })
})

describe('checkoutLines', () => {
  it('rolls halves into cases and keeps the earliest date per salsa', () => {
    let cases = addCase(addCase(addCase([], 'p1', false), 'p1', true), 'p1', true)
    cases = setCaseDate(cases, 1, '2029-03-01')
    cases = setCaseDate(cases, 2, '2029-02-15')
    cases = setCaseDate(cases, 3, '2029-03-01')
    expect(checkoutLines(products, cases)).toEqual([
      {
        productId: 'p1',
        takenCases: 2,
        takenJars: 0,
        expirationDate: '2029-02-15',
        dates: [
          { date: '2029-02-15', cases: 0.5 },
          { date: '2029-03-01', cases: 1.5 },
        ],
      },
    ])
  })

  it('will not check out an undated case', () => {
    expect(() => checkoutLines(products, addCase([], 'p1', false))).toThrow(/date/)
  })

  it('writes who, when and every case date into the note', () => {
    const cases = setCaseDate(setCaseDate(addCase(addCase([], 'p1', false), 'p2', true), 1, '2029-02-15'), 2, '2029-04-01')
    const note = checkoutNote('Jordan', '2026-10-30', checkoutLines(products, cases), new Map(products.map((p) => [p.id, p.name])))
    expect(note).toBe('Checked out by Jordan on 10/30/26. Mild Salsa: 1 × 02/15/29; Verde Hot: ½ × 04/01/29')
  })
})

describe('mergeTaken', () => {
  const line = { productId: 'p1', takenCases: 1, takenJars: 6, expirationDate: '2029-02-15', dates: [] }

  it('adds a second cart to what already went out and keeps the earlier date', () => {
    const merged = mergeTaken({ takenCases: 2, takenJars: 6, expirationDate: new Date('2029-01-10') }, line, 12)
    expect(merged.takenCases).toBe(4)
    expect(merged.takenJars).toBe(0)
    expect(merged.expirationDate.toISOString().slice(0, 10)).toBe('2029-01-10')
  })

  it('takes the line as it is when nothing went out yet', () => {
    const merged = mergeTaken(undefined, line, 12)
    expect(merged).toMatchObject({ takenCases: 1, takenJars: 6 })
    expect(merged.expirationDate.toISOString().slice(0, 10)).toBe('2029-02-15')
  })
})

describe('planLines', () => {
  it('shows planned and scanned products, by category then name', () => {
    const lines = planLines(products, new Map([['p1', 2]]), addCase([], 'p2', true))
    expect(lines.map((line) => [line.product.id, line.planned, line.scanned])).toEqual([
      ['p2', 0, 0.5],
      ['p1', 2, 0],
    ])
  })
})
