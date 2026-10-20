import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  findGroupOption,
  getFundraisingCheckoutFields,
  getFundraisingStorefrontUrl,
  normalizeGroupName,
} from '@/lib/fundraising-site/checkout-fields'
import {
  BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL,
  linkSiteFundraiser,
} from '@/lib/bigcommerce/fundraising-orders'

/**
 * Keeps fundraisers set up on this site listed in the BigCommerce fundraising
 * store too.
 *
 * The store's group list is the checkout dropdown, and BigCommerce's API cannot
 * add options to it, so a person has to. Each day this ties every live site
 * fundraiser already in the dropdown to its store group, and emails the
 * fundraising inbox the exact names of the ones still missing, including linked
 * ones whose option was since removed. It also names fundraisers it could not
 * link because their group already has its own record from earlier store
 * orders, which staff merge by hand. The email repeats daily until each is
 * fixed, because a missing group is a store nobody can credit a sale to.
 */

export type StoreListingResult = { linked: number; missing: number; unlinkable: number }

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type Listing = { option: string; fundraiser: string }

function listItems(items: Listing[]): string {
  const rows = items.map(({ option, fundraiser }) => {
    const note = option === fundraiser ? '' : ` (for ${escapeHtml(fundraiser)})`
    return `<li><strong>${escapeHtml(option)}</strong>${note}</li>`
  })
  return `<ul>${rows.join('')}</ul>`
}

export async function syncSiteFundraisersToStore(now: Date = new Date()): Promise<StoreListingResult> {
  const live = await prisma.fundraiser.findMany({
    where: { isActive: true, status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now } },
    select: { name: true, bigCommerceGroup: true },
    orderBy: { name: 'asc' },
  })
  if (live.length === 0) return { linked: 0, missing: 0, unlinkable: 0 }

  const { groups } = await getFundraisingCheckoutFields()
  const listed = new Set(groups.map((group) => normalizeGroupName(group.label)))
  let linked = 0
  const missing: Listing[] = []
  const unlinkable: Listing[] = []
  for (const fundraiser of live) {
    const name = fundraiser.name.replace(/\s+/g, ' ').trim()
    if (fundraiser.bigCommerceGroup) {
      // Only the normalized key is stored; matching ignores case, so restoring it as written works.
      if (!listed.has(fundraiser.bigCommerceGroup)) missing.push({ option: fundraiser.bigCommerceGroup, fundraiser: name })
      continue
    }
    const option = findGroupOption(groups, fundraiser.name)
    if (!option) missing.push({ option: name, fundraiser: name })
    else if (await linkSiteFundraiser(option.label)) linked++
    else unlinkable.push({ option: option.label, fundraiser: name })
  }

  const total = missing.length + unlinkable.length
  if (total > 0) {
    const sections: string[] = []
    if (missing.length > 0) {
      sections.push(`<p>These fundraisers are live on fundraising.josemadridsalsa.com but are not in the checkout dropdown of the BigCommerce fundraising store (${escapeHtml(getFundraisingStorefrontUrl())}), so supporters there cannot pick them:</p>
${listItems(missing)}
<p>In the BigCommerce control panel, go to <strong>Settings › Form fields › Address fields › Fundraising Group name</strong> and add each one as a new option, spelled exactly as above. Once it is there, its store orders count toward the same fundraiser on the site.</p>`)
    }
    if (unlinkable.length > 0) {
      sections.push(`<p>These are in the dropdown, but earlier store orders already gave their group a separate record, so the site fundraiser and the store group are not yet one campaign. Each pair needs merging by hand:</p>
${listItems(unlinkable)}`)
    }
    await sendEmail({
      to: BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL,
      subject: `${total} fundraiser${total === 1 ? '' : 's'} to fix in the BigCommerce fundraising store`,
      html: `${sections.join('\n')}
<p>This reminder repeats daily until every one is fixed.</p>`,
    })
  }

  return { linked, missing: missing.length, unlinkable: unlinkable.length }
}
