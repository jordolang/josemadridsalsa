import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Facebook, Instagram } from 'lucide-react'
import { SITE_URL as RETAIL_SITE_URL } from '@/lib/site-url'
import { FUNDRAISING_FOOTER_LINKS, FUNDRAISING_SOCIAL } from './nav'
import { RibbonSwoosh } from './ribbon-swoosh'

const LOGO_URL = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/logo-image.webp'

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { href: '/shop', label: 'Shop' },
      { href: '/groups', label: 'Find Your Group' },
      { href: '/why-jose-madrid', label: 'Why Jose Madrid?' },
    ],
  },
  {
    title: 'Get to know us',
    links: [
      { href: '/our-story', label: 'Our Story' },
      { href: '/testimonials', label: 'Testimonials' },
      { href: '/contact', label: 'Contact' },
    ],
  },
] as const

const SOCIAL_ICONS = { Instagram, Facebook } as const

export function FundraisingSiteFooter() {
  return (
    <footer className="bg-neutral-900 text-white">
      <div className="relative overflow-hidden bg-salsa-600">
        <div className="container relative z-10 mx-auto flex flex-col items-center gap-4 px-4 py-6 md:flex-row md:justify-between md:gap-8 md:py-10">
          <p className="font-serif text-3xl font-bold leading-tight md:text-5xl lg:text-6xl">Big flavor. Bigger impact.</p>
          <Link
            href="/start"
            className="flex h-12 w-full max-w-md shrink-0 items-center justify-center gap-2 rounded-md bg-[#FBF8F3] px-8 text-base font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-white md:mr-24 md:w-auto lg:mr-40"
          >
            Start a Fundraiser
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
        <RibbonSwoosh className="w-40 md:w-72 lg:w-96" />
      </div>

      <div className="container mx-auto px-4 pt-8 md:pt-12">
        <div className="grid grid-cols-2 gap-y-8 md:grid-cols-[1.4fr_1fr_1fr] lg:grid-cols-[1.5fr_1fr_1fr_1.3fr] lg:divide-x lg:divide-white/20">
          <div className="col-span-2 md:col-span-1 lg:pr-10">
            <Link href="/" className="flex items-center gap-4" aria-label="Jose Madrid Salsa Fundraising home">
              <span className="rounded-lg bg-white p-1.5">
                <Image src={LOGO_URL} alt="" width={80} height={80} className="h-16 w-16 object-contain md:h-20 md:w-20" />
              </span>
              <span className="font-serif text-2xl font-bold leading-[1.1] md:text-3xl">
                Jose Madrid
                <br />
                Salsa
                <span className="mt-1 block font-sans text-sm font-semibold uppercase tracking-[0.2em] text-salsa-500 md:text-base">
                  Fundraising
                </span>
              </span>
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-white/80 md:text-base">
              Bring people together.
              <br />
              Make a difference.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="border-white/20 md:border-l md:pl-8 lg:border-l-0 lg:pl-12">
              <h2 className="font-semibold">{column.title}</h2>
              <span aria-hidden className="mt-3 block h-[3px] w-10 rounded-full bg-salsa-600" />
              <ul className="mt-5 space-y-3 text-sm text-white/80 md:text-base">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 hidden lg:col-span-1 lg:block lg:pl-12">
            <Link
              href="/groups"
              className="flex h-12 max-w-64 items-center justify-center gap-2 rounded-md border-2 border-white bg-[#FBF8F3] font-semibold text-neutral-900 transition-colors hover:bg-white"
            >
              Find Your Group
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
            <p className="mt-4 text-white/80">Support a fundraiser you love.</p>
            <SocialLinks className="mt-5" />
          </div>
        </div>

        <nav aria-label="Fundraiser resources" className="mt-10 border-t border-white/20 pt-5">
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/60 lg:justify-start">
            {FUNDRAISING_FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={RETAIL_SITE_URL} className="hover:text-white">
                Retail store
              </a>
            </li>
          </ul>
        </nav>

        <div className="flex flex-col items-center gap-4 py-5 text-xs text-white/80 sm:flex-row sm:justify-between sm:text-sm">
          <p>© {new Date().getFullYear()} Jose Madrid Salsa</p>
          <SocialLinks className="lg:hidden" />
          <p className="flex items-center gap-3">
            <a href={`${RETAIL_SITE_URL}/privacy`} className="hover:text-white">
              Privacy Policy
            </a>
            <span aria-hidden className="text-white/40">
              |
            </span>
            <a href={`${RETAIL_SITE_URL}/terms`} className="hover:text-white">
              Terms
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex items-center gap-5 ${className}`}>
      {FUNDRAISING_SOCIAL.map((social) => {
        const Icon = SOCIAL_ICONS[social.label]
        return (
          <li key={social.label}>
            <a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} className="text-white hover:text-salsa-500">
              <Icon className="h-6 w-6" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
