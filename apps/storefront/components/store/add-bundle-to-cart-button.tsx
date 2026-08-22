'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore, bundleCartId } from '@/lib/store/cart'
import { cn } from '@/lib/utils'

export interface AddBundleToCartButtonProps {
  bundle: {
    id: string
    name: string
    slug: string
    price: number
    image: string | null
  }
  /** Component products with their per-unit prorated price, for the cart line + tax/shipping preview. */
  components: Array<{ productId: string; quantity: number; unitPrice: number }>
  /** Most bundles that can be built from current stock (0 → out of stock). */
  maxBundles: number
  /** False when the bundle can't currently be sold (inactive component); disables the button. */
  available: boolean
  className?: string
}

export function AddBundleToCartButton({
  bundle,
  components,
  maxBundles,
  available,
  className,
}: AddBundleToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem)
  const openCart = useCartStore((state) => state.openCart)

  const isOutOfStock = maxBundles <= 0
  const isDisabled = !available || isOutOfStock

  const handleClick = () => {
    if (isDisabled) return
    addItem({
      id: bundleCartId(bundle.id),
      name: bundle.name,
      slug: bundle.slug,
      price: bundle.price,
      image: bundle.image || '/images/placeholder-salsa.jpg',
      sku: `BUNDLE-${bundle.slug}`,
      heatLevel: '',
      maxQuantity: maxBundles,
      bundle: { bundleId: bundle.id, components },
    })
    openCart()
  }

  const label = !available ? 'Unavailable' : isOutOfStock ? 'Out of Stock' : 'Add Bundle to Cart'

  return (
    <Button
      size="lg"
      disabled={isDisabled}
      className={cn('bg-salsa-500 hover:bg-salsa-600', className)}
      onClick={handleClick}
      aria-label={label}
    >
      <ShoppingCart className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}
