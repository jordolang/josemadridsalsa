import Link from 'next/link'
import Image from 'next/image'
import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MapPin,
  Crown,
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
    'Handcrafted, small-batch salsas made in Ohio since 1987. We partner with families, fundraisers, and retail shops across the Midwest.',
  logo: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/logo-image.webp',
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
]

const serviceLinks = [
  { text: 'Shop All Salsas', href: '/salsas' },
  { text: 'Merchandise', href: '/merchandise' },
  { text: 'Gift Certificates', href: '/gift-certificates/purchase' },
  { text: 'Salsa Rewards', href: '/rewards' },
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
    <footer className="w-full place-self-end bg-night-earth text-white">
      <div className="mx-auto max-w-screen-xl px-4 pt-14 pb-6 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="text-center sm:text-left">
            <Link href="/" className="inline-flex items-center gap-3" suppressHydrationWarning>
              <span className="relative h-16 w-16 shrink-0">
                <Image
                  src="/images/home/redesign/logo.webp"
                  alt={`${company.name} logo`}
                  fill
                  className="object-contain"
                  sizes="4rem"
                />
              </span>
              <span className="font-western text-2xl font-semibold uppercase tracking-wide">{company.name}</span>
            </Link>
            <p className="font-script mt-4 text-2xl text-desert-sun-gold">Good Food. Stronger Communities.</p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65 sm:max-w-xs">{description}</p>
            <ul className="mt-6 flex justify-center gap-5 sm:justify-start">
              {social.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-white/80 transition-colors hover:text-desert-sun-gold">
                    <span className="sr-only">{label}</span>
                    <Icon className="size-5" />
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

        <div className="mt-12 grid grid-cols-1 gap-8 border-t border-white/10 pt-10 md:grid-cols-3">
          <ContactColumn items={contacts} />
          <div id="join-our-family" className="scroll-mt-32 [&_*]:text-white [&_input]:text-foreground">
            <FooterNewsletterSignup source="footer:newsletter" />
          </div>
          <div className="text-center sm:text-left">
            <p className="font-western text-sm font-semibold uppercase tracking-[0.18em] text-desert-sun-gold">Share your experience</p>
            <p className="mt-3 text-sm text-white/65">
              Loved the salsa? A quick review helps other families find us.
            </p>
            <div className="mt-4 text-foreground">
              <LeaveAReview variant="compact" source="footer:gmb" triggerLabel="Leave a Google review" />
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-xs text-white/55">
              {overrides?.copyrightText ||
                `\u00a9 ${currentYear} ${company.name}. All rights reserved.`}
            </p>
            <p className="font-script flex items-center gap-1.5 text-2xl text-desert-sun-gold">
              Salsa Kings
              <Crown aria-hidden className="h-4 w-4" />
            </p>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="h-[18px] w-full bg-repeat-x"
        style={{ backgroundImage: "url('/images/home/redesign/border-pattern.webp')", backgroundSize: 'auto 18px' }}
      />
    </footer>
  )
}

type FooterColumnProps = {
  title: string
  links: Array<{ text: string; href: string }>
}

const FooterColumn = ({ title, links }: FooterColumnProps) => (
  <div className="text-center sm:text-left">
    <p className="font-western text-sm font-semibold uppercase tracking-[0.18em] text-desert-sun-gold">{title}</p>
    <ul className="mt-5 space-y-3 text-sm">
      {links.map(({ text, href }) => {
        const isHttp = href.startsWith('http')
        const isExternal = isHttp || href.startsWith('mailto:') || href.startsWith('tel:')
        return (
          <li key={text}>
            {isExternal ? (
              <a
                className="text-white/70 transition-colors hover:text-desert-sun-gold"
                href={href}
                {...(isHttp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {text}
              </a>
            ) : (
              <Link className="text-white/70 transition-colors hover:text-desert-sun-gold" href={href}>
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
    <p className="font-western text-sm font-semibold uppercase tracking-[0.18em] text-desert-sun-gold">Contact Us</p>
    <ul className="mt-5 space-y-3 text-sm">
      {items.map(({ icon: Icon, text, href, isAddress }) => (
        <li key={text}>
          {href ? (
            <a className="flex items-center justify-center gap-1.5 sm:justify-start text-white/70 transition-colors hover:text-desert-sun-gold" href={href}>
              <Icon className="size-4 shrink-0 text-desert-sun-gold" />
              <span className="flex-1">{text}</span>
            </a>
          ) : (
            <div className="flex items-center justify-center gap-1.5 sm:justify-start text-white/70">
              <Icon className="size-4 shrink-0 text-desert-sun-gold" />
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
