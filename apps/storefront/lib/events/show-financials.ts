/**
 * The money side of a show, and the break-even it implies.
 *
 * A manifest (see `manifest-calc.ts`) says how many units left the shop and how many came back,
 * which is the *physical* record. This module is the *financial* one: what the trip cost, what
 * came in as cash and card, and — the number the crew actually wants — how much has to sell for
 * the show to pay for itself.
 *
 * Every figure is entered by hand on return, so every input is nullable and a missing value
 * counts as zero rather than blocking the total. The one derived cross-check, the estimated
 * retail value of the units the manifest says sold, is computed elsewhere and passed in.
 */
import { z } from 'zod'

/** The costs of putting on a show. Booth/fuel/lodging/meals already live on the event. */
export interface ShowCostInputs {
  /** Booth or vendor fee. */
  boothFee: number | null
  costOfFuel: number | null
  lodging: number | null
  meals: number | null
  /** Anything that did not fit the fixed columns — tolls, ice, a broken table. */
  otherExpenses: number | null
}

/** The money taken at the show, split by how it was collected. */
export interface ShowSalesInputs {
  cashSales: number | null
  cardSales: number | null
}

export interface ShowFinancialsInputs extends ShowCostInputs, ShowSalesInputs {}

export interface ShowFinancialsSummary {
  /** Booth + fuel + lodging + meals + other. This is the dollar figure to break even against. */
  totalExpenses: number
  /** Cash + card, the actual money collected. */
  totalSales: number
  /** Sales − expenses. Negative means the show lost money. */
  netProfit: number
  /** What still has to sell to cover the costs. Zero once break-even is reached. */
  amountToBreakEven: number
  /** True once sales cover the costs. */
  hasBrokenEven: boolean
  /** Net profit as a share of sales, 0–1. Null when nothing sold, so it stays undefined not ÷0. */
  margin: number | null
}

/** Sum a list of hand-entered figures, treating a blank (null/undefined/NaN) as zero. */
function sumMoney(values: Array<number | null | undefined>): number {
  const total = values.reduce<number>((acc, v) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
    return acc + Math.max(0, n)
  }, 0)
  return round2(total)
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/** Booth + fuel + lodging + meals + other, blanks counting as zero. */
export function totalExpenses(costs: ShowCostInputs): number {
  return sumMoney([costs.boothFee, costs.costOfFuel, costs.lodging, costs.meals, costs.otherExpenses])
}

/** Cash + card. */
export function totalSales(sales: ShowSalesInputs): number {
  return sumMoney([sales.cashSales, sales.cardSales])
}

/**
 * The full picture for one show.
 *
 * Break-even is expenses expressed as a sales target: "we have to sell $X to get our money back".
 * `amountToBreakEven` is how far short of that the till currently is, floored at zero because a
 * profitable show is not "negative dollars from breaking even" — it has simply broken even.
 */
export function computeShowFinancials(input: ShowFinancialsInputs): ShowFinancialsSummary {
  const expenses = totalExpenses(input)
  const sales = totalSales(input)
  const netProfit = round2(sales - expenses)

  return {
    totalExpenses: expenses,
    totalSales: sales,
    netProfit,
    amountToBreakEven: round2(Math.max(0, expenses - sales)),
    hasBrokenEven: sales >= expenses,
    // Left unrounded: it is a ratio for the UI to format as a percentage, not a money figure.
    margin: sales > 0 ? netProfit / sales : null,
  }
}

/**
 * The estimated retail value of the units a manifest says sold.
 *
 * A cross-check against the cash-and-card total, not a substitute for it: the till is the truth,
 * because samples, discounts, tax and the odd giveaway all sit between "a jar left the table" and
 * "a dollar arrived". Priced at the catalogue price, which is the only price the system knows.
 */
export function estimateManifestRevenue(
  lines: Array<{ soldUnits: number; unitPrice: number | null }>
): number {
  const total = lines.reduce((acc, l) => {
    const units = Number.isFinite(l.soldUnits) ? Math.max(0, l.soldUnits) : 0
    const price = typeof l.unitPrice === 'number' && Number.isFinite(l.unitPrice) ? l.unitPrice : 0
    return acc + units * price
  }, 0)
  return round2(total)
}

/**
 * Validation for the financials a person types into the show form.
 *
 * Money is non-negative and capped at a million — a show that took more than that is a data-entry
 * slip, not a Tuesday. Blank fields arrive as null and are preserved as null rather than coerced
 * to zero, so "not entered yet" stays distinct from "entered as $0".
 */
const money = z
  .number()
  .min(0, 'Cannot be negative')
  .max(1_000_000, 'That figure looks like a typo')
  .nullable()
  .optional()

export const ShowFinancialsInputSchema = z.object({
  boothFee: money,
  costOfFuel: money,
  lodging: money,
  meals: money,
  otherExpenses: money,
  otherExpensesNote: z.string().max(500).nullable().optional(),
  cashSales: money,
  cardSales: money,
})

export type ShowFinancialsInput = z.infer<typeof ShowFinancialsInputSchema>
