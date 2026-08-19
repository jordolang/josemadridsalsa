import type { CaptureFormType, LedgerCategory, LedgerDirection } from '@prisma/client'

/**
 * What each kind of paper this business produces is worth extracting, and where each figure
 * belongs in the ledger.
 *
 * The vocabulary here is taken from the forms in the document archive — the show settlement
 * sheets, farmers-market tallies and mileage logs that have been filled in by hand for a decade.
 * When a new label starts appearing on the paper, add it to the matching rule rather than
 * teaching the extractor a new form type.
 */

export interface LabelRule {
  /** Matched case-insensitively against the label read off the form. */
  match: RegExp
  direction: LedgerDirection
  category: LedgerCategory
  /** True when the row records units (jars, miles) rather than money. */
  isQuantity?: boolean
}

export interface FormSpec {
  formType: CaptureFormType
  /** Shown to the reviewer and used in the extraction prompt. */
  title: string
  /** Plain-language description of the paper, given to the extractor for orientation. */
  description: string
  /** The fields worth pulling off this form, in the order they usually appear. */
  expectedFields: string[]
  /** How a label on this form maps into the ledger. First match wins. */
  labelRules: LabelRule[]
  /** Where unmatched money rows land. */
  fallback: { direction: LedgerDirection; category: LedgerCategory }
}

const TENDER_RULES: LabelRule[] = [
  { match: /\b(cash)\b/i, direction: 'INCOME', category: 'SHOW_SALES' },
  {
    match: /\b(credit|card|visa|mastercard|square|clover|charge)\b/i,
    direction: 'INCOME',
    category: 'SHOW_SALES',
  },
  { match: /\b(check|cheque)\b/i, direction: 'INCOME', category: 'SHOW_SALES' },
  { match: /\b(venmo|paypal|cash ?app|zelle)\b/i, direction: 'INCOME', category: 'SHOW_SALES' },
]

const EXPENSE_RULES: LabelRule[] = [
  { match: /\b(booth|space|stall|vendor) ?fee/i, direction: 'EXPENSE', category: 'BOOTH_FEE' },
  { match: /\b(show|market) ?fee/i, direction: 'EXPENSE', category: 'BOOTH_FEE' },
  { match: /\b(hotel|motel|lodging|room)\b/i, direction: 'EXPENSE', category: 'TRAVEL' },
  { match: /\b(gas|fuel|toll|parking|mileage reimb)/i, direction: 'EXPENSE', category: 'TRAVEL' },
  { match: /\b(meal|food|lunch|dinner|per ?diem)\b/i, direction: 'EXPENSE', category: 'MEALS' },
  { match: /\b(suppl(y|ies)|ice|bags?|napkins?|chips)\b/i, direction: 'EXPENSE', category: 'SUPPLIES' },
  { match: /\b(labor|wages?|payroll|help)\b/i, direction: 'EXPENSE', category: 'PAYROLL' },
]

const QUANTITY_RULES: LabelRule[] = [
  { match: /\b(jars?|units?|cases?|sold)\b/i, direction: 'INCOME', category: 'SHOW_SALES', isQuantity: true },
  { match: /\b(miles?|mileage|odometer)\b/i, direction: 'EXPENSE', category: 'TRAVEL', isQuantity: true },
]

export const FORM_SPECS: Record<CaptureFormType, FormSpec> = {
  SHOW_SETTLEMENT: {
    formType: 'SHOW_SETTLEMENT',
    title: 'Show settlement sheet',
    description:
      'The end-of-show tally sheet. Records the show name and dates, who worked it, jars taken ' +
      'and returned, and the money taken split by how it was paid. Often has a booth fee written ' +
      'on it and a hand-added total.',
    expectedFields: [
      'show name',
      'show date (or start and end date)',
      'salesperson / driver',
      'cash taken',
      'credit or card taken',
      'checks taken',
      'total sales',
      'booth or show fee',
      'jars sold',
      'miles driven',
    ],
    labelRules: [...EXPENSE_RULES, ...TENDER_RULES, ...QUANTITY_RULES],
    fallback: { direction: 'INCOME', category: 'SHOW_SALES' },
  },

  FARMERS_MARKET: {
    formType: 'FARMERS_MARKET',
    title: 'Farmers market day sheet',
    description:
      'A single market day. Simpler than a show sheet: location, date, driver, the money taken ' +
      'and usually the stall fee.',
    expectedFields: [
      'market location',
      'market date',
      'driver',
      'cash taken',
      'credit or card taken',
      'total sales',
      'stall or booth fee',
      'miles driven',
    ],
    labelRules: [...EXPENSE_RULES, ...TENDER_RULES, ...QUANTITY_RULES],
    fallback: { direction: 'INCOME', category: 'SHOW_SALES' },
  },

  FUNDRAISER_ORDER: {
    formType: 'FUNDRAISER_ORDER',
    title: 'Fundraiser order form',
    description:
      'A fundraising group\'s completed order. Lists the organisation, the coordinator, and ' +
      'quantities per salsa flavour. The money figure is the gross order value, not the ' +
      'commission split.',
    expectedFields: [
      'organisation name',
      'coordinator name',
      'order date',
      'quantity per flavour',
      'total jars',
      'total amount due',
      'amount paid',
    ],
    labelRules: [
      { match: /\b(deposit|paid|payment|collected)\b/i, direction: 'INCOME', category: 'PRODUCT_SALES' },
      { match: /\b(donation|donated)\b/i, direction: 'EXPENSE', category: 'OTHER_EXPENSE' },
      ...QUANTITY_RULES,
    ],
    fallback: { direction: 'INCOME', category: 'PRODUCT_SALES' },
  },

  MILEAGE_LOG: {
    formType: 'MILEAGE_LOG',
    title: 'Mileage log',
    description:
      'A driver\'s trip log. One row per trip: date, where it went, round-trip miles, and ' +
      'sometimes odometer readings and the sales taken on that trip.',
    expectedFields: ['trip date', 'destination', 'driver', 'round-trip miles', 'odometer start', 'odometer end'],
    labelRules: [
      { match: /\b(miles?|mileage|round ?trip)\b/i, direction: 'EXPENSE', category: 'TRAVEL', isQuantity: true },
      { match: /\b(toll|parking|gas|fuel)\b/i, direction: 'EXPENSE', category: 'TRAVEL' },
      ...TENDER_RULES,
    ],
    fallback: { direction: 'EXPENSE', category: 'TRAVEL' },
  },

  EXPENSE_RECEIPT: {
    formType: 'EXPENSE_RECEIPT',
    title: 'Expense receipt',
    description:
      'A supplier or retail receipt. The vendor, the date, and the amount paid. Line detail is ' +
      'useful but the total is what posts.',
    expectedFields: ['vendor name', 'purchase date', 'total amount', 'sales tax', 'payment method'],
    labelRules: [
      ...EXPENSE_RULES,
      { match: /\b(jars?|lids?|labels?|ingredients?|produce)\b/i, direction: 'EXPENSE', category: 'COGS' },
      { match: /\b(shipping|postage|ups|usps|fedex)\b/i, direction: 'EXPENSE', category: 'SHIPPING_COST' },
    ],
    fallback: { direction: 'EXPENSE', category: 'OTHER_EXPENSE' },
  },

  OTHER: {
    formType: 'OTHER',
    title: 'Unclassified form',
    description:
      'Anything that does not match a known form. Extract whatever labelled money figures are ' +
      'present and let a person classify them.',
    expectedFields: ['date', 'description', 'amounts'],
    labelRules: [...EXPENSE_RULES, ...TENDER_RULES],
    fallback: { direction: 'EXPENSE', category: 'OTHER_EXPENSE' },
  },
}

/**
 * Map a label read off a form to its ledger classification.
 *
 * Rules are checked in order and the first match wins, so a spec must list its more specific
 * rules first — "show fee" before "cash", because "Cash show fee" is an expense, not takings.
 */
export function classifyLabel(
  label: string,
  formType: CaptureFormType
): { direction: LedgerDirection; category: LedgerCategory; isQuantity: boolean } {
  const spec = FORM_SPECS[formType] ?? FORM_SPECS.OTHER
  for (const rule of spec.labelRules) {
    if (rule.match.test(label)) {
      return {
        direction: rule.direction,
        category: rule.category,
        isQuantity: rule.isQuantity ?? false,
      }
    }
  }
  return { ...spec.fallback, isQuantity: false }
}

/**
 * A "total" row is a summary of the rows above it, not another line of money. Posting it would
 * double the day's takings — the single most likely way this pipeline could inflate revenue.
 */
export function isTotalLabel(label: string): boolean {
  return /\b(total|grand total|sum|subtotal)\b/i.test(label)
}
