import Link from 'next/link'
import Image from 'next/image'
import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import { FooterNewsletterSignup } from '@/components/store/footer-newsletter-signup'
import { LeaveAReview } from '@/components/reviews/leave-a-review'

const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '(740) 521-4304'
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'mike@josemadridsalsa.com'
const headquartersLocation = process.env.NEXT_PUBLIC_HQ_LOCATION ?? '601 Putnam Ave, Zanesville, OH 43701'
const googleBusinessUrl = process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ?? 'https://g.page/jose-madrid-salsa/review'

const company = {
  name: 'Jose Madrid Salsa',
  description:
    'Handcrafted, small-batch salsas made in Ohio since 1989. We partner with families, fundraisers, and retail shops across the Midwest.',
  logo: '/images/shared/logo-image.png',
}

const socialLinks = [
  { icon: Facebook, label: 'Facebook', href: 'https://facebook.com/josemadridsalsa' },
  { icon: Instagram, label: 'Instagram', href: 'https://instagram.com/josemadridsalsa' },
  { icon: Twitter, label: 'X', href: 'https://twitter.com/josemadridsalsa' },
  { icon: MapPin, label: 'Google', href: googleBusinessUrl },
]

const aboutLinks = [
  { text: 'About Jose', href: '/about' },
  { text: 'Our Story', href: '/our-story' },
  { text: 'La Perla Tortilla Factory (Our Chips)', href: '/laperla' },
  { text: 'Find Us Locally', href: '/find-us' },
  { text: 'Where is Jose?', href: '/where-is-jose' },
  { text: 'Recipes', href: '/recipes' },
  { text: 'Developer', href: '/developer' },
  { text: 'Developer Documentation', href: 'https://salsadocs.vercel.app' },
]

const serviceLinks = [
  { text: 'Shop All Salsas', href: '/salsas' },
  { text: 'Merchandise', href: '/merchandise' },
  { text: 'Gift Certificates', href: '/gift-certificates/purchase' },
  { text: 'Fundraising Program', href: '/fundraising' },
]

const helpfulLinks = [
  { text: 'Contact Us', href: '/contact' },
  { text: 'Community Polls', href: '/polls' },
  { text: 'Wholesale Program', href: '/wholesale' },
  { text: 'Retail Partner Resources', href: '/forms' },
  { text: 'Documentation', href: 'https://salsadocs.vercel.app' },
  { text: 'Customer Login', href: '/auth/signin' },
  { text: 'Support', href: `mailto:${supportEmail}` },
]

const legalLinks = [
  { text: 'Return Policy', href: '/returns' },
  { text: 'Privacy Policy', href: '/privacy' },
  { text: 'Terms of Service', href: '/terms' },
  { text: 'Cookie Policy', href: '/cookies' },
  { text: 'Delete My Data', href: '/deletemydata' },
  { text: 'Accessibility', href: '/accessibility' },
]

export interface FooterColumnData {
  title: string
  links: Array<{ text: string; href: string }>
}

export interface FooterOverrides {
  /** Replaces the company blurb under the logo. */
  description?: string
  /** Replaces the four link columns wholesale. */
  columns?: FooterColumnData[]
  /** Replaces the copyright line. */
  copyrightText?: string
  socialLinks?: Array<{ label: string; href: string }>
  contactEmail?: string
  contactPhone?: string
  address?: string
}

/**
 * @param overrides CMS content from /admin/content/footer. Anything left
 *   unset keeps the built-in value, so an unconfigured footer is unchanged.
 */
export function Footer({ overrides }: { overrides?: FooterOverrides } = {}) {
  const currentYear = new Date().getFullYear()

  const description = overrides?.description || company.description
  const columns: FooterColumnData[] =
    overrides?.columns && overrides.columns.length > 0
      ? overrides.columns
      : [
          { title: 'About Us', links: aboutLinks },
          { title: 'Shop', links: serviceLinks },
          { title: 'Helpful Links', links: helpfulLinks },
          { title: 'Policies', links: legalLinks },
        ]

  const social = overrides?.socialLinks?.length
    ? overrides.socialLinks.map((link) => ({
        // CMS social entries carry no icon, so reuse the built-in icon whose
        // label matches and fall back to a generic map pin.
        icon: socialLinks.find((s) => s.label.toLowerCase() === link.label.toLowerCase())?.icon ?? MapPin,
        label: link.label,
        href: link.href,
      }))
    : socialLinks

  const resolvedEmail = overrides?.contactEmail || supportEmail
  const resolvedPhone = overrides?.contactPhone || supportPhone
  const resolvedAddress = overrides?.address || headquartersLocation
  const contacts = [
    { icon: Mail, text: resolvedEmail, href: `mailto:${resolvedEmail}` },
    { icon: Phone, text: resolvedPhone, href: `tel:${resolvedPhone.replace(/[^+\d]/g, '')}` },
    { icon: MapPin, text: resolvedAddress, isAddress: true },
  ]

  return (
    <footer className="bg-secondary dark:bg-secondary/20 mt-16 w-full place-self-end rounded-t-xl">
      <div className="mx-auto max-w-screen-xl px-4 pt-16 pb-6 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div>
            <div className="text-primary flex items-center justify-center gap-3 sm:justify-start" suppressHydrationWarning>
              <div className="relative h-14 w-14 shrink-0">
                <Image
                  src={company.logo}
                  alt={`${company.name} logo`}
                  fill
                  className="object-contain"
                  sizes="3.5rem"
                  priority
                />
              </div>
              <span className="text-2xl font-semibold">{company.name}</span>
            </div>

            <p className="text-foreground/50 mt-6 max-w-md text-center leading-relaxed sm:max-w-xs sm:text-left">
              {description}
            </p>

            <ul className="mt-8 flex justify-center gap-6 sm:justify-start md:gap-8">
              {social.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-primary hover:text-primary/80 transition"
                  >
                    <span className="sr-only">{label}</span>
                    <Icon className="size-6" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 lg:col-span-2">
            {columns.map((column) => (
              <FooterColumn key={column.title} title={column.title} links={column.links} />
            ))}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 border-t pt-12 md:grid-cols-3">
          <ContactColumn items={contacts} />
          <FooterNewsletterSignup source="footer:newsletter" />
          <div className="text-center sm:text-left">
            <p className="text-lg font-medium">Share your experience</p>
            <p className="text-secondary-foreground/70 mt-3 text-sm">
              Loved the salsa? A quick review helps other families find us.
            </p>
            <div className="mt-4">
              <LeaveAReview variant="compact" source="footer:gmb" triggerLabel="Leave a Google review" />
            </div>
          </div>
        </div>

        <div className="mt-12 border-t pt-6">
          <div className="text-center sm:flex sm:justify-between sm:text-left">
            <p className="text-secondary-foreground/70 mt-4 text-sm transition sm:order-first sm:mt-0">
              {overrides?.copyrightText ||
                `\u00a9 ${currentYear} ${company.name}. All rights reserved.`}
            </p>
            <p className="text-sm">
              Crafted in Ohio • Fresh batches every week
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

type FooterColumnProps = {
  title: string
  links: Array<{ text: string; href: string }>
}

const FooterColumn = ({ title, links }: FooterColumnProps) => (
  <div className="text-center sm:text-left">
    <p className="text-lg font-medium">{title}</p>
    <ul className="mt-8 space-y-4 text-sm">
      {links.map(({ text, href }) => {
        const isHttp = href.startsWith('http')
        const isExternal = isHttp || href.startsWith('mailto:') || href.startsWith('tel:')
        return (
          <li key={text}>
            {isExternal ? (
              <a
                className="text-secondary-foreground/70 transition hover:text-primary"
                href={href}
                {...(isHttp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {text}
              </a>
            ) : (
              <Link className="text-secondary-foreground/70 transition hover:text-primary" href={href}>
                {text}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  </div>
)

type ContactItem = {
  icon: typeof Mail
  text: string
  href?: string
  isAddress?: boolean
}

const ContactColumn = ({ items }: { items: ContactItem[] }) => (
  <div className="text-center sm:text-left">
    <p className="text-lg font-medium">Contact Us</p>
    <ul className="mt-8 space-y-4 text-sm">
      {items.map(({ icon: Icon, text, href, isAddress }) => (
        <li key={text}>
          {href ? (
            <a className="flex items-center justify-center gap-1.5 sm:justify-start text-secondary-foreground/70 transition hover:text-primary" href={href}>
              <Icon className="text-primary size-5 shrink-0 shadow-sm" />
              <span className="flex-1">{text}</span>
            </a>
          ) : (
            <div className="flex items-center justify-center gap-1.5 sm:justify-start text-secondary-foreground/70">
              <Icon className="text-primary size-5 shrink-0 shadow-sm" />
              {isAddress ? (
                <address className="flex-1 not-italic">{text}</address>
              ) : (
                <span className="flex-1">{text}</span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  </div>
)

export default Footer
