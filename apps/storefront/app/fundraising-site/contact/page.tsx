import type { Metadata } from 'next'
import { Mail, MapPin, Phone } from 'lucide-react'
import { ContactForm } from '@/components/store/contact-form'
import { FUNDRAISING_CONTACT } from '@/components/fundraising-site/nav'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Questions about a Jose Madrid Salsa fundraiser or an order? Email fundraising@josemadridsalsa.com, call 740-521-4304, or send us a message here.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact us" title="Questions? Comments?">
        <p>Let us know what you are thinking — we are happy to hear from you.</p>
      </PageHero>
      <section className="py-14">
        <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-[1fr_2fr]">
          <aside className="space-y-6">
            <div className="flex items-start gap-3">
              <Mail className="mt-1 h-5 w-5 shrink-0 text-salsa-600" aria-hidden />
              <div>
                <h2 className="font-semibold text-foreground">Email</h2>
                <a href={`mailto:${FUNDRAISING_CONTACT.email}`} className="break-all text-salsa-600 hover:underline">
                  {FUNDRAISING_CONTACT.email}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-1 h-5 w-5 shrink-0 text-salsa-600" aria-hidden />
              <div>
                <h2 className="font-semibold text-foreground">Phone</h2>
                <a href={FUNDRAISING_CONTACT.phoneHref} className="text-salsa-600 hover:underline">
                  {FUNDRAISING_CONTACT.phone}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-salsa-600" aria-hidden />
              <div>
                <h2 className="font-semibold text-foreground">Mail</h2>
                <address className="not-italic text-muted-foreground">
                  Jose Madrid Salsa
                  {FUNDRAISING_CONTACT.mailingAddress.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Asking about an order? Include your order number in your message.
            </p>
          </aside>
          <ContactForm />
        </div>
      </section>
    </>
  )
}
