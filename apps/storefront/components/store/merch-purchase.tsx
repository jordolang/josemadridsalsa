'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MerchProduct, MerchVariant } from '@/lib/merchandise/catalog'
import { formatPrice, MERCH_MAX_QUANTITY } from '@/lib/merchandise/shared'

type Props = { product: MerchProduct }

function initialVariant(product: MerchProduct): MerchVariant {
  return product.variants.find((variant) => variant.isDefault) ?? product.variants[0]
}

/** The variant matching every chosen option value, if one is for sale. */
function findVariant(product: MerchProduct, selected: number[]): MerchVariant | undefined {
  return product.variants.find((variant) => selected.every((id, index) => variant.optionIds[index] === id))
}

export function MerchPurchase({ product }: Props) {
  const [selected, setSelected] = useState<number[]>(() => initialVariant(product).optionIds)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const variant = findVariant(product, selected)

  const variantImages = useMemo(() => {
    if (!variant) return product.images
    const matching = product.images.filter((image) => image.variantIds.includes(variant.id))
    return matching.length > 0 ? matching : product.images
  }, [product.images, variant])

  const mainImage =
    variantImages.find((image) => image.src === activeImage)?.src ?? variantImages[0]?.src ?? null

  function choose(optionIndex: number, valueId: number) {
    const next = [...selected]
    next[optionIndex] = valueId
    // If that combination is not sold (say, a size missing in this color), keep the choice
    // just made and fall back to the first variant that has it.
    if (!findVariant(product, next)) {
      const fallback = product.variants.find((candidate) => candidate.optionIds[optionIndex] === valueId)
      if (fallback) {
        setSelected(fallback.optionIds)
        setActiveImage(null)
        return
      }
    }
    setSelected(next)
    setActiveImage(null)
  }

  function isAvailable(optionIndex: number, valueId: number): boolean {
    return product.variants.some(
      (candidate) =>
        candidate.optionIds[optionIndex] === valueId &&
        selected.every((id, index) => index === optionIndex || candidate.optionIds[index] === id)
    )
  }

  async function buy() {
    if (!variant) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/merchandise/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, variantId: variant.id, quantity }),
      })
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Checkout is not available right now.')
      }
      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout is not available right now.')
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted">
          {mainImage ? (
            <Image
              src={mainImage}
              alt={product.title}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          ) : null}
        </div>
        {variantImages.length > 1 ? (
          <div className="grid grid-cols-5 gap-2">
            {variantImages.slice(0, 10).map((image) => (
              <button
                key={image.src}
                type="button"
                onClick={() => setActiveImage(image.src)}
                className={cn(
                  'relative aspect-square overflow-hidden rounded-lg border bg-muted',
                  image.src === mainImage ? 'border-salsa-500 ring-2 ring-salsa-500/40' : 'border-border'
                )}
                aria-label={`Show ${product.title} photo`}
              >
                <Image src={image.src} alt="" fill className="object-cover" sizes="96px" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">{product.title}</h1>
          <p className="text-2xl font-semibold text-salsa-600">
            {variant ? formatPrice(variant.priceCents) : 'Unavailable'}
          </p>
        </div>

        {product.options.map((option, optionIndex) => (
          <fieldset key={option.name} className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">
              {option.name}
              {selected[optionIndex] !== undefined ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {option.values.find((value) => value.id === selected[optionIndex])?.title}
                </span>
              ) : null}
            </legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selected[optionIndex] === value.id
                const available = isAvailable(optionIndex, value.id)
                return (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => choose(optionIndex, value.id)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition',
                      active
                        ? 'border-salsa-500 bg-salsa-50 text-salsa-700 dark:bg-salsa-500/15 dark:text-salsa-200'
                        : 'border-border bg-card text-foreground hover:border-salsa-300',
                      !available && !active && 'opacity-50'
                    )}
                  >
                    {option.type === 'color' && value.color ? (
                      <span
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: value.color }}
                        aria-hidden
                      />
                    ) : null}
                    {value.title}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Quantity</p>
          <div className="inline-flex items-center rounded-full border border-border">
            <button
              type="button"
              className="p-2 disabled:opacity-40"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className="p-2 disabled:opacity-40"
              onClick={() => setQuantity((q) => Math.min(MERCH_MAX_QUANTITY, q + 1))}
              disabled={quantity >= MERCH_MAX_QUANTITY}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-salsa-600 text-white hover:bg-salsa-700"
            onClick={buy}
            disabled={!variant || submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Buy now
          </Button>
          <p className="text-xs text-muted-foreground">
            Secure checkout with Square. Printed to order and shipped by our print partner, usually within 2 to 7
            business days plus shipping time. Shipping is calculated at checkout.
          </p>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {product.description ? (
          <div className="space-y-2 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
