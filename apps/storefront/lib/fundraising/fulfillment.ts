import type { BrochureOption, FulfillmentMethod } from '@prisma/client'

/**
 * How a group runs its drive, and what we tell them about it.
 *
 * The wording matters as much as the enum here: a coordinator who reaches the end of a drive
 * surprised to learn they owe us an invoice, or surprised that nothing was written down
 * anywhere on their side, is a coordinator we lost. So the explanation lives beside the
 * definition rather than being retyped into each form that asks the question.
 */

/**
 * The online link is live on every campaign, whichever method is chosen.
 *
 * Stated as a constant because it is the fact most likely to be forgotten when someone later
 * reads `ONLINE_ONLY` and assumes its opposite must close the store. It does not: a supporter
 * who would rather not fill in a paper form still needs somewhere to buy.
 */
export const ONLINE_STORE_ALWAYS_AVAILABLE = true

export interface FulfillmentOptionCopy {
  value: FulfillmentMethod
  label: string
  /** Shown next to the label on the signup form. */
  tagline: string
  /** The full explanation. Paragraphs, in order. */
  body: string[]
  /** What the group is taking on, said plainly. */
  tradeOff: string
  recommended: boolean
}

export const FULFILLMENT_OPTIONS: FulfillmentOptionCopy[] = [
  {
    value: 'ORDER_FORMS_AND_BULK',
    label: "We'll collect order forms ourselves",
    tagline: 'The classic drive — brochures, collected forms, one delivery at the end',
    body: [
      'You hand out brochures with an order form on them. Your sellers collect the completed forms and the money as they go. At the end of your fundraising period we deliver your entire drive in one shipment for a small delivery fee, and you sort the jars and hand them out to your buyers.',
      'Because you collect the orders and the money yourself, you have your own paperwork the whole way through — you know exactly who ordered what, who has paid, and where you stand.',
      'How the money works: you keep everything you collect. At the end we invoice you for our half of the salsa, plus the delivery fee and the brochures if you took the printed ones. What is left over is yours. You are buying the salsa from us and reselling it to your supporters, so sales tax on those orders is yours to handle — we will ask for your resale certificate.',
    ],
    tradeOff:
      'It is more work. Someone has to hand out the forms, chase them down, handle cash safely, and be there to sort and distribute the delivery.',
    recommended: true,
  },
  {
    value: 'ONLINE_ONLY',
    label: 'Online orders only',
    tagline: 'No paper, no cash, no delivery day',
    body: [
      'You share your link and that is the whole drive. We take every payment, ship each order straight to the buyer, and credit your share automatically as orders come in — there is nothing to invoice and nothing to settle.',
    ],
    tradeOff:
      'You will not be handling any orders or money yourself, so you will have no records of your own. Checking your sales dashboard is the only way to know whether people are actually ordering.',
    recommended: false,
  },
]

/**
 * Shown under both options, because it is true of both and is the single most common thing a
 * coordinator misunderstands about a paper drive.
 */
export const ONLINE_LINK_NOTE =
  'You get your link either way. Even if you are collecting paper forms, anyone who would rather order online can use it — an out-of-town relative, someone who missed the form, someone who would just rather pay by card. Those orders ship straight to that person’s own address and they pay their own shipping and sales tax at checkout, so they will not turn up in your bulk delivery and will not affect your paperwork. Your group is credited for them just the same.'

export interface BrochureOptionCopy {
  value: BrochureOption
  label: string
  detail: string
}

export const BROCHURE_OPTIONS: BrochureOptionCopy[] = [
  {
    value: 'PRINT_YOUR_OWN',
    label: "I'll print them myself — free",
    detail:
      'We send you a print-ready brochure with the order form on it. Print as many as you need.',
  },
  {
    value: 'PROFESSIONAL_100',
    label: 'Send us 100 professionally printed brochures',
    detail:
      'There is a nominal fee, and it comes out of your total at the end rather than out of your pocket now.',
  },
]

export const RESALE_NUMBER_NOTE =
  'Because you are reselling the salsa to your supporters, we need this on file before we can invoice you without sales tax. If you do not have one to hand you can add it later, but we will need it before your delivery goes out.'

/** Whether this method involves collecting order forms and taking a bulk delivery. */
export function collectsOrderForms(method: FulfillmentMethod): boolean {
  return method === 'ORDER_FORMS_AND_BULK'
}

/**
 * Whether a brochure choice and a resale certificate apply.
 *
 * Both hang off the paper drive: an online-only campaign has nothing to print and makes no
 * wholesale purchase, so asking either question of one would be noise.
 */
export function needsBrochureChoice(method: FulfillmentMethod): boolean {
  return collectsOrderForms(method)
}

export function needsResaleCertificate(method: FulfillmentMethod): boolean {
  return collectsOrderForms(method)
}

/** Short admin-facing labels, for tables and audit entries. */
export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  ORDER_FORMS_AND_BULK: 'Order forms + bulk delivery',
  ONLINE_ONLY: 'Online only',
}

export const BROCHURE_LABELS: Record<BrochureOption, string> = {
  PRINT_YOUR_OWN: 'Prints their own',
  PROFESSIONAL_100: '100 professionally printed',
}

export interface FulfillmentTerms {
  fulfillmentMethod: FulfillmentMethod
  brochureOption: BrochureOption | null
  resaleNumber: string | null
}

/**
 * What a campaign is actually set up with, from what the admin chose and what the school asked.
 *
 * The admin wins. A phone call between the application and the approval routinely changes the
 * answer, and the person on that call is the one clicking approve — so the form's answer is a
 * request, not the agreement. Absent both, a group collects order forms, because that is the
 * classic drive and what most of them run.
 *
 * Brochures and the resale certificate are cleared rather than carried on an online-only
 * campaign: there is nothing to print and no wholesale purchase to exempt, so keeping either
 * would describe something that never happens.
 */
export function resolveFulfillmentTerms(input: {
  adminChoice?: { method?: FulfillmentMethod; brochure?: BrochureOption; resaleNumber?: string }
  request?: {
    requestedFulfillment?: FulfillmentMethod | null
    requestedBrochure?: BrochureOption | null
    resaleNumber?: string | null
  } | null
}): FulfillmentTerms {
  const { adminChoice, request } = input

  const fulfillmentMethod =
    adminChoice?.method ?? request?.requestedFulfillment ?? 'ORDER_FORMS_AND_BULK'

  if (!collectsOrderForms(fulfillmentMethod)) {
    return { fulfillmentMethod, brochureOption: null, resaleNumber: null }
  }

  return {
    fulfillmentMethod,
    // Printing their own is the free option, so it is the safe default to land on when nobody
    // said: it cannot bill a group for something they did not ask for.
    brochureOption: adminChoice?.brochure ?? request?.requestedBrochure ?? 'PRINT_YOUR_OWN',
    resaleNumber: adminChoice?.resaleNumber ?? request?.resaleNumber ?? null,
  }
}
