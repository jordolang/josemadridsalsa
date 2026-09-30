/** The fundraising site's main menu. Paths are on the fundraising host. */
export const FUNDRAISING_NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/groups', label: 'Find Your Group' },
  { href: '/why-jose-madrid', label: 'Why Jose Madrid?' },
  { href: '/our-story', label: 'Our Story' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/contact', label: 'Contact' },
] as const

/** Footer-only links, alongside the main menu. */
export const FUNDRAISING_FOOTER_LINKS = [
  { href: '/start', label: 'Start Your Fundraiser' },
  { href: '/sign-up', label: 'Fundraiser Sign-Up' },
  { href: '/submit', label: 'Submit an Order Form' },
  { href: '/survey', label: 'Customer Survey' },
  { href: '/blog', label: 'Blog' },
  { href: '/shipping', label: 'Shipping & Satisfaction' },
] as const

export const FUNDRAISING_CONTACT = {
  email: 'fundraising@josemadridsalsa.com',
  phone: '740-521-4304',
  phoneHref: 'tel:+17405214304',
  mailingAddress: ['PO Box 1061', 'Zanesville, OH 43702'],
} as const
