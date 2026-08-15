import { Metadata } from 'next'
import { Mail, Phone, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ContactForm } from '@/components/store/contact-form'
import { createMetadata } from '@/lib/metadata'
import { getStoreSettings } from '@/lib/store-settings'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Contact Us - Jose Madrid Salsa',
  description:
    'Get in touch with Jose Madrid Salsa. Questions about our salsas, fundraising, wholesale, or an order? Send us a message and our team in Zanesville, Ohio will get back to you.',
  pathname: '/contact',
})

export default async function ContactPage() {
  // Store-managed identity wins; env vars and the historical hardcoded values are the
  // fallbacks so the page keeps rendering before an admin fills the settings in.
  const settings = await getStoreSettings()

  const supportEmail =
    settings.supportEmail ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'mike@josemadridsalsa.com'
  const supportPhone =
    settings.supportPhone ?? process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '(740) 521-4304'
  const headquartersLocation =
    settings.businessAddress ??
    process.env.NEXT_PUBLIC_HQ_LOCATION ??
    '601 Putnam Ave, Zanesville, OH 43701'
  const businessName = settings.businessName?.trim() || null
  // Lead with the business name when it's been set, so the identity field is actually shown.
  const fullLocation = businessName
    ? `${businessName}, ${headquartersLocation}`
    : headquartersLocation

  const contactDetails = [
    {
      icon: Mail,
      label: 'Email',
      value: supportEmail,
      href: `mailto:${supportEmail}`,
    },
    {
      icon: Phone,
      label: 'Phone',
      value: supportPhone,
      href: `tel:${supportPhone.replace(/[^+\d]/g, '')}`,
    },
    {
      icon: MapPin,
      label: 'Headquarters',
      value: fullLocation,
      href: `https://maps.google.com/?q=${encodeURIComponent(fullLocation)}`,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative bg-gradient-to-r from-salsa-600 via-salsa-700 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 font-serif text-4xl font-bold text-shadow-lg lg:text-6xl">
              Contact Us
            </h1>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed text-salsa-100 lg:text-2xl">
              Questions about our salsas, fundraising, or an order? We&apos;d love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.5fr]">
            {/* Contact details */}
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-bold text-foreground">Reach out directly</h2>
                <p className="mt-2 text-muted-foreground">
                  Prefer to call or email? Here&apos;s how to find us.
                </p>
              </div>

              <ul className="space-y-4">
                {contactDetails.map(({ icon: Icon, label, value, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      {...(href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="flex items-start gap-4 rounded-lg border bg-card p-4 transition hover:border-salsa-300 hover:bg-salsa-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-salsa-100 text-salsa-700">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-muted-foreground">
                          {label}
                        </span>
                        <span className="block font-medium text-foreground">{value}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Form */}
            <Card>
              <CardContent className="p-6 lg:p-8">
                <h2 className="mb-6 font-serif text-2xl font-bold text-foreground">
                  Send us a message
                </h2>
                <ContactForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
