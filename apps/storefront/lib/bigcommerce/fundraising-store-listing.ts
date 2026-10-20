import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  findGroupOption,
  getFundraisingCheckoutFields,
  getFundraisingStorefrontUrl,
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
 * fundraising inbox the exact names of the ones still missing. The email
 * repeats daily until each is added, because a missing group is a store
 * nobody can credit a sale to.
 */

export type StoreListingResult = { linked: number; missing: number }

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function syncSiteFundraisersToStore(now: Date = new Date()): Promise<StoreListingResult> {
  const live = await prisma.fundraiser.findMany({
    where: {
      isActive: true,
      status: 'ACTIVE',
      bigCommerceGroup: null,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { name: true },
    orderBy: { name: 'asc' },
  })
  if (live.length === 0) return { linked: 0, missing: 0 }

  const { groups } = await getFundraisingCheckoutFields()
  let linked = 0
  const missing: string[] = []
  for (const fundraiser of live) {
    const option = findGroupOption(groups, fundraiser.name)
    if (!option) missing.push(fundraiser.name.replace(/\s+/g, ' ').trim())
    else if (await linkSiteFundraiser(option.label)) linked++
  }

  if (missing.length > 0) {
    const items = missing.map((name) => `<li><strong>${escapeHtml(name)}</strong></li>`).join('')
    await sendEmail({
      to: BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL,
      subject: `Add ${missing.length} fundraiser${missing.length === 1 ? '' : 's'} to the BigCommerce fundraising store`,
      html: `<p>These fundraisers are live on fundraising.josemadridsalsa.com but are not in the checkout dropdown of the BigCommerce fundraising store (${escapeHtml(getFundraisingStorefrontUrl())}), so supporters there cannot pick them:</p>
<ul>${items}</ul>
<p>In the BigCommerce control panel, go to <strong>Settings › Form fields › Address fields › Fundraising Group name</strong> and add each one as a new option, spelled exactly as above. Once it is there, its store orders count toward the same fundraiser on the site. This reminder repeats daily until every name is added.</p>`,
    })
  }

  return { linked, missing: missing.length }
}
