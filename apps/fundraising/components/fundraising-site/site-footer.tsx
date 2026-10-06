import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { FooterNewsletterSignup } from '@/components/store/footer-newsletter-signup'
import { SITE_URL as RETAIL_SITE_URL } from '@/lib/site-url'
import { FUNDRAISING_CONTACT, FUNDRAISING_FOOTER_LINKS, FUNDRAISING_NAV } from './nav'

export function FundraisingSiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto grid gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="mb-4 font-serif text-lg font-bold text-foreground">Navigate</h2>
          <ul className="space-y-2 text-sm">
            {FUNDRAISING_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 font-serif text-lg font-bold text-foreground">Fundraisers</h2>
          <ul className="space-y-2 text-sm">
            {FUNDRAISING_FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={RETAIL_SITE_URL} className="text-muted-foreground hover:text-foreground">
                Retail store at josemadrid.net
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-4 font-serif text-lg font-bold text-foreground">Contact</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-salsa-600" aria-hidden />
              <span>
                Jose Madrid Salsa
                {FUNDRAISING_CONTACT.mailingAddress.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-salsa-600" aria-hidden />
              <a href={`mailto:${FUNDRAISING_CONTACT.email}`} className="break-all hover:text-foreground">
                {FUNDRAISING_CONTACT.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-salsa-600" aria-hidden />
              <a href={FUNDRAISING_CONTACT.phoneHref} className="hover:text-foreground">
                {FUNDRAISING_CONTACT.phone}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-4 font-serif text-lg font-bold text-foreground">Exclusive offers</h2>
          <p className="mb-3 text-sm text-muted-foreground">New flavors and fundraising news, a few times a year.</p>
          <FooterNewsletterSignup source="fundraising-site:footer" />
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Jose Madrid Salsa · Zanesville, Ohio
      </div>
    </footer>
  )
}
