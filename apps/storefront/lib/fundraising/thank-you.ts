/**
 * The thank-you page a supporter lands on after buying from a fundraiser's store.
 *
 * Fundraising organizations write their own copy, but a campaign that customises nothing
 * still gets a page of its own: the blanks are filled from the organization's name, so the
 * page reads as the school's or team's rather than as the generic store confirmation.
 */

export interface FundraiserThankYouSource {
  name: string
  organizationName: string
  logoUrl?: string | null
  thankYouHeadline?: string | null
  thankYouMessage?: string | null
  thankYouImageUrl?: string | null
  thankYouCtaLabel?: string | null
  thankYouCtaUrl?: string | null
}

export interface FundraiserThankYou {
  headline: string
  message: string
  imageUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
}

/** Blank strings count as unset: an emptied textarea should fall back, not render nothing. */
function orNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function fundraiserThankYou(
  fundraiser: FundraiserThankYouSource,
  options: { slug?: string } = {}
): FundraiserThankYou {
  const ctaUrl = orNull(fundraiser.thankYouCtaUrl)
  const ctaLabel = orNull(fundraiser.thankYouCtaLabel)
  const campaignUrl = options.slug ? `/fundraisers/${options.slug}` : null

  return {
    headline:
      orNull(fundraiser.thankYouHeadline) ??
      `Thank you for supporting ${fundraiser.organizationName}!`,
    message:
      orNull(fundraiser.thankYouMessage) ??
      `Your order goes straight to work for ${fundraiser.name}. Half of every jar you bought ` +
        `goes directly to ${fundraiser.organizationName} — the rest covers the salsa, and your ` +
        `shipping pays only for getting the order to your door.`,
    imageUrl: orNull(fundraiser.thankYouImageUrl) ?? orNull(fundraiser.logoUrl),
    // A campaign that set no call to action still gets one back to its own page, which is
    // where a supporter goes to share it.
    ctaUrl: ctaUrl ?? campaignUrl,
    ctaLabel: ctaUrl ? (ctaLabel ?? 'Learn more') : campaignUrl ? 'Back to the campaign' : null,
  }
}
