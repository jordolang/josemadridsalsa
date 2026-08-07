/**
 * System page registry.
 *
 * A SYSTEM page is a route that already exists as hand-written React. The CMS
 * does not own its layout — it owns the copy, imagery and links inside each
 * section, plus whether a section is shown and in what order.
 *
 * Adding a route here is all that is needed to make it editable: the admin
 * page editor, the seeder and the public `usePageContent` helpers are all
 * driven off this table.
 *
 * `key` is stable and stored on `PageSection.type`; renaming one orphans the
 * saved content, so treat these as permanent identifiers.
 */

export interface SystemPageSectionDefinition {
  /** Stable identifier, stored as PageSection.type. */
  key: string
  /** Block definition used to render the edit form. */
  block: string
  label: string
  description?: string
  /** Section is structural and cannot be hidden from the public page. */
  required?: boolean
  defaults?: Record<string, unknown>
}

export interface SystemPageDefinition {
  slug: string
  title: string
  /** Public route this page controls. */
  route: string
  description: string
  sections: SystemPageSectionDefinition[]
}

/** Standard shape for the long-form policy and information pages. */
function contentPage(
  slug: string,
  title: string,
  route: string,
  description: string
): SystemPageDefinition {
  return {
    slug,
    title,
    route,
    description,
    sections: [
      {
        key: 'header',
        block: 'richText',
        label: 'Page header',
        description: 'Title and introduction shown at the top of the page.',
        required: true,
      },
      {
        key: 'body',
        block: 'richText',
        label: 'Body copy',
        description: 'The main content of the page.',
        required: true,
      },
    ],
  }
}

export const SYSTEM_PAGES: SystemPageDefinition[] = [
  {
    slug: 'home',
    title: 'Homepage',
    route: '/',
    description: 'The storefront landing page.',
    sections: [
      {
        key: 'hero',
        block: 'videoHero',
        label: 'Hero',
        description: 'Scroll-scrubbed video hero at the top of the page.',
        required: true,
      },
      {
        key: 'featuredProducts',
        block: 'productGrid',
        label: 'Featured products',
        description: 'Products flagged as featured and in stock.',
        defaults: { heading: 'Featured Salsas', source: 'featured', limit: 8 },
      },
      {
        key: 'fundraisingPromo',
        block: 'imageText',
        label: 'Fundraising promo',
        description: 'Fundraising pitch with stats and buttons.',
      },
      {
        key: 'heatLevels',
        block: 'richText',
        label: 'Heat level categories',
        description: 'Heading above the mild/medium/hot category tiles.',
      },
      {
        key: 'heatIndex',
        block: 'heatIndex',
        label: 'Heat Index stories',
        description: 'Newest posts from the blog.',
        defaults: { heading: 'From the Heat Index', limit: 3 },
      },
      {
        key: 'whatSetsUsApart',
        block: 'imageText',
        label: 'What sets us apart',
        description: 'Brand story block with supporting image.',
      },
      {
        key: 'whereIsJose',
        block: 'locations',
        label: 'Where is Jose',
        description: 'Live show schedule and map.',
      },
      {
        key: 'activeCampaigns',
        block: 'richText',
        label: 'Active fundraising campaigns',
        description: 'Heading above the live campaign grid.',
      },
      {
        key: 'giftBoxes',
        block: 'richText',
        label: 'Gift box selector',
        description: 'Heading above the gift box builder.',
      },
      {
        key: 'locationMap',
        block: 'locations',
        label: 'Store locator map',
        description: 'Retailer map near the foot of the page.',
      },
    ],
  },
  {
    slug: 'about',
    title: 'About',
    route: '/about',
    description: 'Company overview page.',
    sections: [
      { key: 'hero', block: 'hero', label: 'Hero', required: true },
      { key: 'body', block: 'richText', label: 'Body copy', required: true },
      { key: 'cta', block: 'cta', label: 'Closing call to action' },
    ],
  },
  {
    slug: 'our-story',
    title: 'Our Story',
    route: '/our-story',
    description: 'Brand history and founder story.',
    sections: [
      { key: 'hero', block: 'hero', label: 'Hero', required: true },
      { key: 'body', block: 'richText', label: 'Story copy', required: true },
      { key: 'gallery', block: 'imageText', label: 'Feature image and caption' },
    ],
  },
  {
    slug: 'wholesale',
    title: 'Wholesale',
    route: '/wholesale',
    description: 'Wholesale enquiry page.',
    sections: [
      { key: 'hero', block: 'hero', label: 'Hero', required: true },
      { key: 'body', block: 'richText', label: 'Body copy', required: true },
      { key: 'faq', block: 'faq', label: 'Wholesale FAQ' },
      { key: 'cta', block: 'cta', label: 'Closing call to action' },
    ],
  },
  {
    slug: 'fundraising',
    title: 'Fundraising',
    route: '/fundraising',
    description: 'Fundraising programme overview.',
    sections: [
      { key: 'hero', block: 'hero', label: 'Hero', required: true },
      { key: 'howItWorks', block: 'richText', label: 'How it works' },
      { key: 'faq', block: 'faq', label: 'Fundraising FAQ' },
      { key: 'cta', block: 'cta', label: 'Closing call to action' },
    ],
  },
  {
    slug: 'find-us',
    title: 'Find Us',
    route: '/find-us',
    description: 'Store locator page.',
    sections: [
      { key: 'header', block: 'richText', label: 'Page header', required: true },
      { key: 'map', block: 'locations', label: 'Locator map', required: true },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact',
    route: '/contact',
    description: 'Contact form page.',
    sections: [
      { key: 'header', block: 'richText', label: 'Page header', required: true },
      { key: 'details', block: 'richText', label: 'Contact details' },
    ],
  },
  contentPage('shipping', 'Shipping', '/shipping', 'Shipping policy.'),
  contentPage('returns', 'Returns', '/returns', 'Returns policy.'),
  contentPage('refunds', 'Refunds', '/refunds', 'Refund policy.'),
  contentPage('privacy', 'Privacy Policy', '/privacy', 'Privacy policy.'),
  contentPage('terms', 'Terms of Service', '/terms', 'Terms of service.'),
  contentPage('accessibility', 'Accessibility', '/accessibility', 'Accessibility statement.'),
  contentPage('cookies', 'Cookie Policy', '/cookies', 'Cookie policy.'),
]

const SYSTEM_PAGES_BY_SLUG = new Map(SYSTEM_PAGES.map((page) => [page.slug, page]))

export function getSystemPage(slug: string): SystemPageDefinition | undefined {
  return SYSTEM_PAGES_BY_SLUG.get(slug)
}

export function isSystemPageSlug(slug: string): boolean {
  return SYSTEM_PAGES_BY_SLUG.has(slug)
}
