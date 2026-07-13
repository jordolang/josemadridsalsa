'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Minus, Plus, ShoppingBasket, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CatalogProduct {
  id: string
  productId: string
  name: string
  slug: string
  price: number
  imageUrl: string | null
  description: string | null
}

export interface TeamProductCatalogProps {
  teamId: string
  teamSlug: string
  teamName: string
  teamColor: string
  products: CatalogProduct[]
  className?: string
}

/**
 * Public catalog rendered inside the fundraiser page. Lets a supporter pick
 * quantities across a team's product list and check out. The resulting
 * Stripe session carries fundraiserTeamId metadata, so the webhook fires
 * applyPurchaseDamage on settlement — that's the arena trigger.
 */
export function TeamProductCatalog({
  teamId,
  teamSlug,
  teamName,
  teamColor,
  products,
  className,
}: TeamProductCatalogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + (quantities[p.id] ?? 0) * p.price,
        0,
      ),
    [products, quantities],
  )
  const selectedCount = useMemo(
    () =>
      Object.values(quantities).reduce((sum, n) => sum + Math.max(0, n), 0),
    [quantities],
  )

  function bump(teamProductId: string, delta: number) {
    setQuantities((q) => {
      const next = Math.max(0, Math.min(99, (q[teamProductId] ?? 0) + delta))
      return { ...q, [teamProductId]: next }
    })
  }

  async function handleCheckout() {
    setError(null)
    const items = products
      .map((p) => ({
        teamProductId: p.id,
        quantity: quantities[p.id] ?? 0,
      }))
      .filter((i) => i.quantity > 0)
    if (items.length === 0) {
      setError('Select at least one item to continue.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/fundraiser/shop/create-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, items }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success || !data.url) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Unable to start checkout',
        )
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (products.length === 0) {
    return (
      <section
        className={cn(
          'rounded-3xl border border-dashed border-slate-200 bg-white/60 p-6 text-center shadow-sm',
          className,
        )}
      >
        <ShoppingBasket className="mx-auto h-8 w-8 text-slate-400" />
        <h3 className="mt-2 text-base font-semibold text-slate-900">
          No products listed yet
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {teamName} is setting up their salsa catalog. Check back soon.
        </p>
      </section>
    )
  }

  return (
    <section
      className={cn(
        'rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8',
        className,
      )}
      aria-label={`${teamName} salsa catalog`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Shop {teamName}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Every jar you buy damages rival teams in the Battle Arena.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: `${teamColor}14`,
            color: teamColor,
          }}
        >
          <Swords className="h-3.5 w-3.5" />
          Arena triggers on purchase
        </div>
      </header>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {products.map((p) => {
          const qty = quantities[p.id] ?? 0
          return (
            <li
              key={p.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="relative aspect-[4/3] w-full bg-slate-100">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <ShoppingBasket className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {p.description}
                    </p>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-lg font-bold text-slate-900">
                    ${p.price.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      aria-label={`Decrease ${p.name} quantity`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => bump(p.id, -1)}
                      disabled={qty === 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold text-slate-900">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${p.name} quantity`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-white"
                      onClick={() => bump(p.id, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Subtotal
          </p>
          <p className="text-2xl font-bold text-slate-900">
            ${subtotal.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">
            {selectedCount} item{selectedCount === 1 ? '' : 's'} · supports{' '}
            <span className="font-semibold">{teamName}</span>
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleCheckout}
          disabled={pending || selectedCount === 0}
          className="h-12 rounded-2xl px-6 text-base font-bold text-white shadow-md transition"
          style={{ backgroundColor: teamColor }}
        >
          {pending ? 'Loading…' : `Buy & strike ${teamSlug}'s rivals`}
        </Button>
      </footer>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded bg-destructive/10 p-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </section>
  )
}
