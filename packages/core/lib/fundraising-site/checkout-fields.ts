/**
 * The fundraising store's checkout asks every buyer two custom questions:
 * which group they are supporting (a dropdown staff keep up to date in the
 * BigCommerce control panel — Settings › Form fields) and the salesperson's
 * name (free text). Those two answers are how every fundraising sale is
 * credited, so this site reads the same dropdown rather than keeping a second
 * list that could drift from it.
 *
 * BigCommerce's management API does not expose address form fields; the
 * storefront's public form-fields endpoint does.
 */

const DEFAULT_STOREFRONT_URL = 'https://josemadridsalsafundraising.com'

/** Fallback freshness; staff add groups a few times a month. */
const FIELDS_REVALIDATE_SECONDS = 300

export const FUNDRAISING_FIELDS_TAG = 'bigcommerce:fundraising-form-fields'

export type FundraisingGroupOption = { value: string; label: string }

export type FundraisingCheckoutFields = {
  groupFieldId: string
  groups: FundraisingGroupOption[]
  sellerFieldId: string | null
}

type RawField = {
  id: string
  custom: boolean
  label: string
  fieldType?: string
  options?: { items?: Array<{ value: string; label: string }> }
}

/** The fundraising store's own storefront origin, where its hosted checkout lives. */
export function getFundraisingStorefrontUrl(): string {
  const configured = process.env.BIGCOMMERCE_FUNDRAISING_STOREFRONT_URL?.trim()
  return (configured || DEFAULT_STOREFRONT_URL).replace(/\/+$/, '')
}

// The labels have been reworded over the years ("Fundraiser Group",
// "Fundraising Group name ", "Sales Person", "Salesperson").
const GROUP_LABEL = /fundrais\w*\s+group/i
const SELLER_LABEL = /sales\s*person/i

/** Pulls the two attribution fields out of the storefront's billing-address fields. */
export function parseFundraisingCheckoutFields(payload: unknown): FundraisingCheckoutFields | null {
  const billing = (payload as { billingAddress?: RawField[] } | null)?.billingAddress
  if (!Array.isArray(billing)) return null

  const group = billing.find((field) => field.custom && GROUP_LABEL.test(field.label))
  if (!group) return null
  const seller = billing.find((field) => field.custom && SELLER_LABEL.test(field.label))

  const groups = (group.options?.items ?? [])
    .map((item) => ({ value: String(item.value), label: item.label.trim() }))
    .filter((item) => item.label)

  return { groupFieldId: group.id, groups, sellerFieldId: seller?.id ?? null }
}

/**
 * The live group list and field ids. Throws when the store cannot be reached
 * or the dropdown has been renamed beyond recognition — a shop that cannot
 * credit a sale to its group must not quietly take orders.
 */
export async function getFundraisingCheckoutFields(): Promise<FundraisingCheckoutFields> {
  const res = await fetch(`${getFundraisingStorefrontUrl()}/api/storefront/form-fields`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: FIELDS_REVALIDATE_SECONDS, tags: [FUNDRAISING_FIELDS_TAG] },
  })
  if (!res.ok) throw new Error(`Fundraising store form fields returned ${res.status}`)
  const fields = parseFundraisingCheckoutFields(await res.json())
  if (!fields) throw new Error('Fundraising store has no "Fundraising Group" checkout field')
  return fields
}

/** Case-, spacing- and apostrophe-insensitive form of a group name, for matching across systems. */
export function normalizeGroupName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function findGroupOption(
  groups: FundraisingGroupOption[],
  name: string,
): FundraisingGroupOption | null {
  const wanted = normalizeGroupName(name)
  return groups.find((group) => normalizeGroupName(group.label) === wanted) ?? null
}
