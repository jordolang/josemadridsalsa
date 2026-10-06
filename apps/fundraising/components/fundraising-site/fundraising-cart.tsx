'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Lock, Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  MAX_LINE_QUANTITY,
  cartItemCount,
  cartSubtotal,
  useFundraisingCart,
} from '@/lib/fundraising-site/cart-store'
import { formatPrice } from './product-card'

/** The fundraising store charges one flat rate per order, whatever the size. */
const FLAT_SHIPPING = 10

type Props = {
  /** Groups in the checkout dropdown; null when the list could not be loaded. */
  groups: string[] | null
}

export function FundraisingCart({ groups }: Props) {
  const { lines, group, seller, setQuantity, remove, setGroup, setSeller } = useFundraisingCart()
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setHydrated(true), [])

  // A remembered group that has since left the dropdown can't be credited.
  const groupIsListed = !!groups?.includes(group)
  const canCheckout = lines.length > 0 && groupIsListed && seller.trim().length > 0 && !submitting

  if (!hydrated) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading cart" />
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="mb-6 text-lg text-muted-foreground">Your cart is empty.</p>
        <Button asChild className="bg-salsa-600 hover:bg-salsa-700">
          <Link href="/shop">Shop salsa</Link>
        </Button>
      </div>
    )
  }

  async function checkout() {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/fundraising-site/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          group,
          seller: seller.trim(),
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string }
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Checkout is unavailable right now. Please try again in a moment.')
      }
      window.location.assign(data.checkoutUrl)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setSubmitting(false)
    }
  }

  const subtotal = cartSubtotal(lines)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {lines.map((line) => (
          <li key={line.productId} className="flex gap-4 p-4">
            <Link href={`/shop/${line.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white">
              {line.image && <Image src={line.image} alt="" fill sizes="80px" className="object-contain p-1" />}
            </Link>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/shop/${line.slug}`} className="font-medium text-foreground hover:text-salsa-600">
                  {line.name}
                </Link>
                <span className="font-semibold tabular-nums">{formatPrice(line.price * line.quantity)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md border border-input" role="group" aria-label={`Quantity of ${line.name}`}>
                  <button
                    type="button"
                    className="p-2 hover:bg-muted"
                    onClick={() => setQuantity(line.productId, line.quantity - 1)}
                    aria-label="Fewer jars"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    className="p-2 hover:bg-muted disabled:opacity-40"
                    onClick={() => setQuantity(line.productId, line.quantity + 1)}
                    disabled={line.quantity >= MAX_LINE_QUANTITY}
                    aria-label="More jars"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(line.productId)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="fundraising-group">Group you’re supporting</Label>
          {groups === null ? (
            <p role="alert" className="text-sm text-destructive">
              The group list can’t be loaded right now. Please try again in a few minutes.
            </p>
          ) : (
            <Select value={groupIsListed ? group : ''} onValueChange={setGroup}>
              <SelectTrigger id="fundraising-group" className="w-full">
                <SelectValue placeholder="Choose your group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fundraising-seller">Salesperson</Label>
          <Input
            id="fundraising-seller"
            value={seller}
            maxLength={120}
            autoComplete="off"
            placeholder="Student or member who asked you to buy"
            onChange={(event) => setSeller(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">So the group can credit the right person.</p>
        </div>

        <dl className="space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{cartItemCount(lines)} jars</dt>
            <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping (flat rate)</dt>
            <dd className="tabular-nums">{formatPrice(FLAT_SHIPPING)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <dt>Estimated total</dt>
            <dd className="tabular-nums">{formatPrice(subtotal + FLAT_SHIPPING)}</dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button onClick={checkout} disabled={!canCheckout} className="w-full bg-salsa-600 hover:bg-salsa-700" size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Lock className="mr-2 h-4 w-4" aria-hidden />}
          Secure checkout
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You’ll pay on our secure checkout, where you’ll confirm your group and salesperson.
        </p>
      </aside>
    </div>
  )
}
