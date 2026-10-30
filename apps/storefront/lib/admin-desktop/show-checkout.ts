/**
 * Checking salsa out for a show by scanning the label on each case.
 *
 * The scanner is a keyboard, as on the stock and pack sheets: it types a code
 * and presses Enter. Every case-label scan is one case on the cart, or half a
 * case (six jars) when ⌘ (Ctrl on Windows) is held while it scans. Each case is
 * kept on its own, in the order it went on the cart, because each one carries
 * its own date: once the cart is full, the dates code switches the sheet to
 * entering them, month and day only — the year is always three years out.
 *
 * What is saved is the show's packing manifest, the same record as the show
 * form, so a checkout reads back on the form as cases and jars taken with an
 * expiration date per salsa.
 */

import { findByCode } from './scan'

export interface CheckoutProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  category: string
  unitsPerCase: number
}

/** A show salsa can be checked out for, with its manifest when it has one. */
export interface CheckoutShow {
  id: string
  title: string
  startDate: string
  location: string
  manifest: {
    status: 'DRAFT' | 'PACKED' | 'RETURNED'
    items: { productId: string; takenCases: number; takenJars: number }[]
  } | null
}

/** One case (or half case) on the cart. */
export interface CheckedCase {
  /** Order on the cart, from 1, so a date pass walks the cases as they were loaded. */
  seq: number
  productId: string
  half: boolean
  /** yyyy-mm-dd, once entered. */
  date: string | null
}

/** Planned cases per product. Halves are allowed: 1.5 is a case and a half. */
export type CheckoutPlan = ReadonlyMap<string, number>

/** Printed on the code sheet. Scanning it switches between scanning cases and entering dates. */
export const DATES_CODE = 'JMSDATES'
/** Printed on the code sheet. Makes the next case scan a half case, for when ⌘ is not to hand. */
export const HALF_CODE = 'JMSHALF'
/**
 * The two-digit codes on the sheet carry this prefix ("JD02" for 02). Scanners
 * often refuse very short Code 128 symbols out of the box, so a bare "02" might
 * never read.
 */
export const DIGIT_CODE_PREFIX = 'JD'

/** Case dates are always three years out from the year the salsa is packed. */
export const EXPIRY_YEARS_AHEAD = 3

const digitsOf = (code: string) => code.replace(/\D/g, '').replace(/^0+/, '')

/**
 * The product a case label names.
 *
 * A case label may carry the jar's own UPC, the SKU, or a 14-digit case code
 * (GTIN-14): a packaging digit, then the jar's GTIN-13 less its check digit,
 * then a new check digit. The middle of a GTIN-14 is matched against the jar's
 * barcode less its check digit, so the case code never has to be entered on
 * the product.
 */
export function findCaseProduct(products: CheckoutProduct[], code: string): CheckoutProduct | undefined {
  const asScan = products.map((product) => ({ ...product, inventory: 0 }))
  const direct = findByCode(asScan, code)
  if (direct) return products.find((product) => product.id === direct.id)

  const digits = code.replace(/\D/g, '')
  if (digits.length !== 14 || digits.length !== code.trim().length) return undefined
  const core = digitsOf(digits.slice(1, 13))
  if (core.length < 6) return undefined
  return products.find((product) => {
    const barcode = product.barcode?.replace(/\D/g, '') ?? ''
    return barcode.length >= 8 && digitsOf(barcode.slice(0, -1)) === core
  })
}

/** Put one case on the cart. */
export function addCase(cases: CheckedCase[], productId: string, half: boolean): CheckedCase[] {
  const seq = cases.reduce((max, entry) => Math.max(max, entry.seq), 0) + 1
  return [...cases, { seq, productId, half, date: null }]
}

/** Take the last case of a product back off the cart. */
export function removeLastCase(cases: CheckedCase[], productId: string): CheckedCase[] {
  const last = [...cases].reverse().find((entry) => entry.productId === productId)
  return last ? cases.filter((entry) => entry.seq !== last.seq) : cases
}

/** Cases of a product, counting a half as 0.5. */
export function caseCount(cases: CheckedCase[], productId?: string): number {
  return cases
    .filter((entry) => !productId || entry.productId === productId)
    .reduce((sum, entry) => sum + (entry.half ? 0.5 : 1), 0)
}

/** "2", "1½", "½". */
export function formatCases(count: number): string {
  const whole = Math.floor(count)
  const half = count - whole >= 0.5
  if (!half) return String(whole)
  return whole === 0 ? '½' : `${whole}½`
}

/** The case a date goes on: the first undated one, of one product when a label was just scanned. */
export function nextUndated(cases: CheckedCase[], productId?: string): CheckedCase | undefined {
  return cases.find((entry) => !entry.date && (!productId || entry.productId === productId))
}

export function setCaseDate(cases: CheckedCase[], seq: number, date: string): CheckedCase[] {
  return cases.map((entry) => (entry.seq === seq ? { ...entry, date } : entry))
}

/** The year a case packed in `packedYear` is dated. */
export function expiryYear(packedYear: number): number {
  return packedYear + EXPIRY_YEARS_AHEAD
}

export type DateInput =
  | { kind: 'date'; date: string; label: string }
  | { kind: 'pending'; digits: string }
  | { kind: 'error'; message: string }

const pad = (value: number) => String(value).padStart(2, '0')

function toDate(month: number, day: number, year: number): DateInput {
  if (month < 1 || month > 12) return { kind: 'error', message: `There is no month ${pad(month)}. Enter MM/DD.` }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > daysInMonth) {
    return { kind: 'error', message: `${pad(month)}/${pad(day)} is not a date in ${year}. Enter MM/DD.` }
  }
  return {
    kind: 'date',
    date: `${year}-${pad(month)}-${pad(day)}`,
    label: `${pad(month)}/${pad(day)}/${String(year).slice(-2)}`,
  }
}

/**
 * Read a case date from what was typed or scanned, month and day only.
 *
 * `02/15` and `2/15` are complete. Digits build up across entries so the code
 * sheet works: scan 02, then 15, and the second scan completes `0215`. Typing
 * `0215` at once does the same.
 */
export function readDateInput(input: string, pending: string, packedYear: number): DateInput {
  const year = expiryYear(packedYear)
  const typed = input.trim().toUpperCase()

  const slashed = typed.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*\d{2,4})?$/)
  if (slashed) return toDate(Number(slashed[1]), Number(slashed[2]), year)

  const digits = typed.startsWith(DIGIT_CODE_PREFIX) ? typed.slice(DIGIT_CODE_PREFIX.length) : typed
  if (!/^\d+$/.test(digits)) return { kind: 'error', message: `${input.trim()} is not a date. Enter MM/DD, like 02/15.` }

  const all = pending + digits
  if (all.length < 4) return { kind: 'pending', digits: all }
  if (all.length > 4) return { kind: 'error', message: `${all} is too many digits. Enter MM/DD, like 02/15.` }
  return toDate(Number(all.slice(0, 2)), Number(all.slice(2)), year)
}

/** How a scan should be taken, before a product is looked up. */
export function isControlCode(code: string): 'dates' | 'half' | null {
  const typed = code.trim().toUpperCase()
  if (typed === DATES_CODE) return 'dates'
  if (typed === HALF_CODE) return 'half'
  return null
}

export interface PlanLine {
  product: CheckoutProduct
  planned: number
  scanned: number
}

/**
 * Plan beside what is on the cart, in the show form's order: by category, then
 * name. Products scanned but not planned are included, so nothing on the cart
 * is hidden.
 */
export function planLines(products: CheckoutProduct[], plan: CheckoutPlan, cases: CheckedCase[]): PlanLine[] {
  return products
    .map((product) => ({ product, planned: plan.get(product.id) ?? 0, scanned: caseCount(cases, product.id) }))
    .filter((line) => line.planned > 0 || line.scanned > 0)
    .sort(
      (a, b) =>
        a.product.category.localeCompare(b.product.category) || a.product.name.localeCompare(b.product.name),
    )
}

/** One product as it is written to the manifest. */
export interface CheckoutLine {
  productId: string
  takenCases: number
  takenJars: number
  /** The earliest case date: the one that runs out first. */
  expirationDate: string
  /** Each distinct date with how many cases carry it, for the manifest note. */
  dates: { date: string; cases: number }[]
}

/** Jars in half a case. */
export function halfCaseJars(unitsPerCase: number): number {
  return Math.floor((unitsPerCase > 0 ? unitsPerCase : 12) / 2)
}

/**
 * The cart as manifest lines. Every case must be dated first; a line's jars
 * roll up into whole cases the way the show form would show them.
 */
export function checkoutLines(products: CheckoutProduct[], cases: CheckedCase[]): CheckoutLine[] {
  const byId = new Map(products.map((product) => [product.id, product]))
  const grouped = new Map<string, CheckedCase[]>()
  for (const entry of cases) {
    if (!entry.date) throw new Error('Every case needs its date before checkout.')
    grouped.set(entry.productId, [...(grouped.get(entry.productId) ?? []), entry])
  }

  return [...grouped].map(([productId, entries]) => {
    const per = byId.get(productId)?.unitsPerCase || 12
    const jars = entries.reduce((sum, entry) => sum + (entry.half ? halfCaseJars(per) : per), 0)
    const counts = new Map<string, number>()
    for (const entry of entries) counts.set(entry.date!, (counts.get(entry.date!) ?? 0) + (entry.half ? 0.5 : 1))
    const dates = [...counts].map(([date, count]) => ({ date, cases: count })).sort((a, b) => a.date.localeCompare(b.date))
    return {
      productId,
      takenCases: Math.floor(jars / per),
      takenJars: jars % per,
      expirationDate: dates[0].date,
      dates,
    }
  })
}

const shortDate = (date: string) => `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(2, 4)}`

/**
 * The line added to the manifest's notes: who checked out, when, and every
 * case date. The manifest keeps one date per salsa, so a salsa whose cases
 * carry different dates has the rest written down here.
 */
export function checkoutNote(
  checkedOutBy: string,
  checkoutDate: string,
  lines: CheckoutLine[],
  names: ReadonlyMap<string, string>,
): string {
  const items = lines
    .map((line) => {
      const dates = line.dates.map((entry) => `${formatCases(entry.cases)} × ${shortDate(entry.date)}`).join(', ')
      return `${names.get(line.productId) ?? line.productId}: ${dates}`
    })
    .join('; ')
  return `Checked out by ${checkedOutBy} on ${shortDate(checkoutDate)}. ${items}`
}

/** What a product already on the manifest becomes once this checkout is added. */
export function mergeTaken(
  existing: { takenCases: number; takenJars: number; expirationDate: Date | null } | undefined,
  line: CheckoutLine,
  unitsPerCase: number,
): { takenCases: number; takenJars: number; expirationDate: Date } {
  const per = unitsPerCase > 0 ? unitsPerCase : 12
  const jars =
    (existing ? existing.takenCases * per + existing.takenJars : 0) + line.takenCases * per + line.takenJars
  const added = new Date(line.expirationDate)
  const expirationDate = existing?.expirationDate && existing.expirationDate < added ? existing.expirationDate : added
  return { takenCases: Math.floor(jars / per), takenJars: jars % per, expirationDate }
}
