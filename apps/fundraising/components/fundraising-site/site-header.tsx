'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ShoppingCart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cartItemCount, useFundraisingCart } from '@/lib/fundraising-site/cart-store'
import { FUNDRAISING_NAV } from './nav'

const LOGO_URL = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/logo-image.webp'

export function FundraisingSiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // The cart lives in localStorage; render the count only after hydration.
  const [hydrated, setHydrated] = useState(false)
  const count = useFundraisingCart((state) => cartItemCount(state.lines))

  useEffect(() => setHydrated(true), [])
  useEffect(() => setOpen(false), [pathname])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href))

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-[72px] items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Jose Madrid Salsa Fundraising home">
          <Image src={LOGO_URL} alt="Jose Madrid Salsa" width={48} height={48} className="h-12 w-12 object-contain" priority />
          <span className="font-serif text-lg font-bold leading-tight text-foreground">
            Jose Madrid Salsa
            <span className="block text-xs font-sans font-semibold uppercase tracking-widest text-salsa-600">
              Fundraising
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {FUNDRAISING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground ${
                isActive(item.href) ? 'text-salsa-600' : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="hidden bg-salsa-600 hover:bg-salsa-700 sm:inline-flex">
            <Link href="/start">Start a Fundraiser</Link>
          </Button>
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
          <button
            type="button"
            className="rounded-md p-2 text-foreground hover:bg-muted xl:hidden"
            aria-expanded={open}
            aria-controls="fundraising-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="fundraising-mobile-nav" aria-label="Main" className="border-t border-border bg-background xl:hidden">
          <ul className="container mx-auto flex flex-col px-4 py-2">
            {FUNDRAISING_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-3 text-base font-medium hover:bg-muted ${
                    isActive(item.href) ? 'text-salsa-600' : 'text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/start" className="block rounded-md px-3 py-3 text-base font-semibold text-salsa-600 hover:bg-muted">
                Start a Fundraiser
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
