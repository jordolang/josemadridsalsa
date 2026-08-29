import { describe, expect, it } from 'vitest'

import { fundraiserThankYou } from '@/lib/fundraising/thank-you'

const campaign = {
  name: 'Spring Salsa Drive',
  organizationName: 'Zanesville High Band',
  logoUrl: 'https://example.com/logo.png',
}

describe('fundraiserThankYou', () => {
  it('writes a page around the organization when nothing is customised', () => {
    const page = fundraiserThankYou(campaign, { slug: 'zhs-band' })

    expect(page.headline).toBe('Thank you for supporting Zanesville High Band!')
    expect(page.message).toContain('Spring Salsa Drive')
    expect(page.message).toContain('Zanesville High Band')
    // The logo stands in for a thank-you image nobody uploaded.
    expect(page.imageUrl).toBe('https://example.com/logo.png')
    expect(page.ctaUrl).toBe('/fundraisers/zhs-band')
    expect(page.ctaLabel).toBe('Back to the campaign')
  })

  it("uses the organization's own copy when they have written some", () => {
    const page = fundraiserThankYou(
      {
        ...campaign,
        thankYouHeadline: 'Go Blue Devils!',
        thankYouMessage: 'Your salsa buys new uniforms.',
        thankYouImageUrl: 'https://example.com/team.jpg',
        thankYouCtaLabel: 'See our season',
        thankYouCtaUrl: 'https://example.com/season',
      },
      { slug: 'zhs-band' }
    )

    expect(page).toEqual({
      headline: 'Go Blue Devils!',
      message: 'Your salsa buys new uniforms.',
      imageUrl: 'https://example.com/team.jpg',
      ctaLabel: 'See our season',
      ctaUrl: 'https://example.com/season',
    })
  })

  it('treats an emptied field as unset rather than rendering a blank page', () => {
    const page = fundraiserThankYou(
      { ...campaign, thankYouHeadline: '   ', thankYouMessage: '' },
      { slug: 'zhs-band' }
    )

    expect(page.headline).toBe('Thank you for supporting Zanesville High Band!')
    expect(page.message).not.toBe('')
  })

  it('labels a custom link even when the organization named no label', () => {
    const page = fundraiserThankYou({ ...campaign, thankYouCtaUrl: 'https://example.com' })

    expect(page.ctaUrl).toBe('https://example.com')
    expect(page.ctaLabel).toBe('Learn more')
  })

  it('offers no call to action when there is no campaign page to point at', () => {
    const page = fundraiserThankYou(campaign)

    expect(page.ctaUrl).toBeNull()
    expect(page.ctaLabel).toBeNull()
  })
})
