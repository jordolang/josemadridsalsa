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

const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '(740) 521-4304'
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'mike@josemadrid.net'
const headquartersLocation = process.env.NEXT_PUBLIC_HQ_LOCATION ?? '601 Putnam Ave, Zanesville, OH 43701'
const googleBusinessUrl = process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ?? 'https://g.page/jose-madrid-salsa/review'

const company = {
  name: 'Jose Madrid Salsa',
  description:
    'Handcrafted, small-batch salsas made in Ohio since 1989. We partner with families, fundraisers, and retail shops across the Midwest.',
  logo: '/images/jose-madrid-salsa-logo.png',
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
  { text: 'Find Us Locally', href: '/find-us' },
  { text: 'Where is Jose?', href: '/where-is-jose' },
  { text: 'Recipes', href: '/recipes' },
  { text: 'Developer', href: '/developer' },
]

const serviceLinks = [
  { text: 'Shop All Salsas', href: '/salsas' },
  { text: 'Merchandise', href: '/merchandise' },
  { text: 'Gift Certificates', href: '/gift-certificates/purchase' },
  { text: 'Fundraising Program', href: '/fundraising' },
]

const helpfulLinks = [
  { text: 'Wholesale Program', href: '/wholesale' },
  { text: 'Retail Partner Resources', href: '/forms' },
  { text: 'Customer Login', href: '/auth/signin' },
  { text: 'Support', href: `mailto:${supportEmail}` },
]

const legalLinks = [
  { text: 'Privacy Policy', href: '/privacy' },
  { text: 'Terms of Service', href: '/terms' },
  { text: 'Cookie Policy', href: '/cookies' },
  { text: 'Accessibility', href: '/accessibility' },
]

const contactInfo = [
  { icon: Mail, text: supportEmail, href: `mailto:${supportEmail}` },
  { icon: Phone, text: supportPhone, href: `tel:${supportPhone.replace(/[^+\d]/g, '')}` },
  { icon: MapPin, text: headquartersLocation, isAddress: true },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-secondary dark:bg-secondary/20 mt-16 w-full place-self-end rounded-t-xl">
      <div className="mx-auto max-w-screen-xl px-4 pt-16 pb-6 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div>
            <div className="text-primary flex justify-center gap-2 sm:justify-start" suppressHydrationWarning>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-salsa-700 p-1">
                <Image
                  src={company.logo}
                  alt={`${company.name} logo`}
                  width={48}
                  height={48}
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-2xl font-semibold">{company.name}</span>
            </div>

            <p className="text-foreground/50 mt-6 max-w-md text-center leading-relaxed sm:max-w-xs sm:text-left">
              {company.description}
            </p>

            <ul className="mt-8 flex justify-center gap-6 sm:justify-start md:gap-8">
              {socialLinks.map(({ icon: Icon, label, href }) => (
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
            <FooterColumn title="About Us" links={aboutLinks} />
            <FooterColumn title="Shop" links={serviceLinks} />
            <FooterColumn title="Helpful Links" links={helpfulLinks} />
            <FooterColumn title="Policies" links={legalLinks} />
            <ContactColumn items={contactInfo} />
          </div>
        </div>

        <div className="mt-12 border-t pt-6">
          <div className="text-center sm:flex sm:justify-between sm:text-left">
            <p className="text-secondary-foreground/70 mt-4 text-sm transition sm:order-first sm:mt-0">
              &copy; {currentYear} {company.name}. All rights reserved.
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
        const isExternal = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')
        return (
          <li key={text}>
            {isExternal ? (
              <a className="text-secondary-foreground/70 transition hover:text-primary" href={href}>
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
