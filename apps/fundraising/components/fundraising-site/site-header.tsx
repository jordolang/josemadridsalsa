'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ChevronRight, Menu, ShoppingCart, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cartItemCount, useFundraisingCart } from '@/lib/fundraising-site/cart-store'
import { FUNDRAISING_NAV } from './nav'
import { RibbonSwoosh } from './ribbon-swoosh'

const LOGO_URL = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/logo-image.webp'
const PORTAL_HOME = '/fundraiser-portal/dashboard'

export function FundraisingSiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // The cart lives in localStorage; render the count only after hydration.
  const [hydrated, setHydrated] = useState(false)
  const count = useFundraisingCart((state) => cartItemCount(state.lines))
  const { data: session } = useSession()
  // A fundraiser's account opens the portal; anyone else signs in and lands there. A signed-in
  // shopper with no fundraiser would only be bounced from the portal back to sign-in.
  const account =
    session?.user?.fundraiserId
      ? { href: PORTAL_HOME, label: 'My Fundraiser' }
      : { href: `/auth/signin?${new URLSearchParams({ callbackUrl: PORTAL_HOME })}`, label: 'Fundraiser Login' }

  useEffect(() => setHydrated(true), [])
  useEffect(() => setOpen(false), [pathname])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href))

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="relative overflow-hidden bg-salsa-600 text-white">
        <p className="container mx-auto flex h-8 items-center justify-center gap-4 px-4 text-[10px] font-medium uppercase tracking-[0.4em] sm:text-xs">
          <span aria-hidden className="h-px w-10 bg-white/70 sm:w-16" />
          Fundraising with flavor
          <span aria-hidden className="h-px w-10 bg-white/70 sm:w-16" />
        </p>
        <RibbonSwoosh className="w-28 sm:w-48" />
      </div>

      <div className="container mx-auto flex h-20 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Jose Madrid Salsa Fundraising home">
          <Image src={LOGO_URL} alt="Jose Madrid Salsa" width={56} height={56} className="h-14 w-14 object-contain" priority />
          <span className="font-serif text-xl font-bold leading-[1.1] text-foreground">
            Jose Madrid
            <br />
            Salsa
            <span className="mt-0.5 block font-sans text-xs font-semibold uppercase tracking-[0.2em] text-salsa-600">
              Fundraising
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {FUNDRAISING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`relative whitespace-nowrap px-3 py-2 text-[15px] text-foreground transition-colors after:absolute after:inset-x-3 after:-bottom-1 after:h-[3px] after:rounded-full after:bg-salsa-600 after:transition-transform hover:text-salsa-600 ${
                isActive(item.href) ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Button asChild className="mr-2 hidden h-11 bg-salsa-600 px-5 text-base hover:bg-salsa-700 md:inline-flex">
            <Link href="/start">
              Start a Fundraiser
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
          <Link
            href={account.href}
            className="hidden rounded-md p-2 text-foreground hover:bg-muted md:block"
            aria-label={account.label}
            title={account.label}
          >
            <User className="h-6 w-6" />
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-foreground hover:bg-muted xl:hidden"
            aria-expanded={open}
            aria-controls="fundraising-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
          <span aria-hidden className="mx-1 h-7 w-px bg-border xl:hidden" />
          <Link
            href="/cart"
            className="relative rounded-md p-2 text-foreground hover:bg-muted"
            aria-label={hydrated && count > 0 ? `Cart, ${count} jars` : 'Cart'}
          >
            <ShoppingCart className="h-6 w-6" />
            {hydrated && count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-salsa-600 px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 md:hidden">
        <Button asChild className="h-12 w-full bg-salsa-600 text-base hover:bg-salsa-700">
          <Link href="/start">
            Start a Fundraiser
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        </Button>
      </div>

      {open && (
        <nav id="fundraising-mobile-nav" aria-label="Main" className="border-t border-border bg-background xl:hidden">
          <ul className="container mx-auto flex flex-col px-4 py-2">
            {FUNDRAISING_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`block rounded-md px-3 py-3 text-base font-medium hover:bg-muted ${
                    isActive(item.href) ? 'text-salsa-600' : 'text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={account.href} className="block rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted">
                {account.label}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
