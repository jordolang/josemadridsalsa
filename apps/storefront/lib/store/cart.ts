import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateCreator } from 'zustand'
import { getSalsaBundle, priceCartLines } from '@/lib/bundles'

export interface CartItem {
  /**
   * Cart line key. A loose jar is keyed by its product id; a jar inside a mix-and-match pack
   * is keyed by pack instance too, so the same salsa can sit in a pack and on its own without
   * the two lines merging into one.
   */
  id: string
  /** The catalogue product. Absent on lines added before packs existed — see `cartItemProductId`. */
  productId?: string
  name: string
  slug: string
  /** What the customer pays per jar. Inside a pack this is a share of the pack price. */
  price: number
  image: string
  quantity: number
  sku: string
  heatLevel: string
  maxQuantity?: number
  /** Which pack this jar belongs to, e.g. `choose-5`. Absent on loose jars. */
  bundleId?: string
  /** Which instance of that pack, so two Choose 5 packs stay separate. */
  bundleGroupId?: string
  /** The pack's name, for the cart to label the line with. */
  bundleName?: string
}

/** One jar the customer picked for a pack. */
export interface BundleSelection {
  productId: string
  name: string
  slug: string
  image: string
  sku: string
  heatLevel: string
  /** Catalogue price. Used only to split the pack price across the jars. */
  price: number
}

/**
 * The product a cart line refers to.
 *
 * Pack lines key themselves by pack instance, and carts saved before packs existed have no
 * `productId` at all, so nothing may read `item.id` as a product id directly.
 */
export function cartItemProductId(item: CartItem): string {
  return item.productId ?? item.id
}

/**
 * The cart as the checkout routes want it.
 *
 * The pack tags travel with the items so the server can recognise a pack, check it holds the
 * right jars and charge the pack price. Every checkout caller goes through here — the price
 * itself is never sent, because the server recomputes it.
 *
 * The same salsa filling two slots of one pack is two cart lines but one order line, so the
 * lines are merged per product within their pack.
 */
export function toCheckoutItems(items: CartItem[]) {
  const merged = new Map<
    string,
    { productId: string; quantity: number; bundleId?: string; bundleGroupId?: string }
  >()

  for (const item of items) {
    const productId = cartItemProductId(item)
    const key = `${item.bundleGroupId ?? ''}:${productId}`
    const existing = merged.get(key)

    if (existing) {
      existing.quantity += item.quantity
    } else {
      merged.set(key, {
        productId,
        quantity: item.quantity,
        bundleId: item.bundleId,
        bundleGroupId: item.bundleGroupId,
      })
    }
  }

  return Array.from(merged.values())
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  guestEmail?: string

  // Computed
  totalItems: () => number
  totalPrice: () => number

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  addBundle: (bundleId: string, selections: BundleSelection[]) => boolean
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  setGuestEmail: (email: string) => void
}

// Debounced cart tracking
let trackingTimeout: NodeJS.Timeout | null = null
async function trackCartChanges(items: CartItem[], guestEmail?: string) {
  // Clear any existing timeout
  if (trackingTimeout) {
    clearTimeout(trackingTimeout)
  }

  // Debounce for 2 seconds to avoid excessive API calls
  trackingTimeout = setTimeout(async () => {
    try {
      await fetch('/api/cart/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          guestEmail,
        }),
      })
    } catch (error) {
      console.error('Failed to track cart:', error)
    }
  }, 2000)
}

/** Identifies one instance of a pack, so two of the same pack in a cart stay apart. */
function newBundleGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pack-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

const cartStoreConfig: StateCreator<CartStore> = (set, get) => ({
  items: [],
  isOpen: false,
  guestEmail: undefined,

  addItem: (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const items = get().items
    const existingItem = items.find((item: CartItem) => item.id === newItem.id)

    let updatedItems: CartItem[]
    if (existingItem) {
      // Update quantity if item already exists
      const newQuantity = existingItem.quantity + (newItem.quantity || 1)
      const maxQuantity = newItem.maxQuantity || 99

      updatedItems = items.map((item: CartItem) =>
        item.id === newItem.id
          ? { ...item, quantity: Math.min(newQuantity, maxQuantity) }
          : item
      )
    } else {
      // Add new item
      updatedItems = [
        ...items,
        { productId: newItem.id, ...newItem, quantity: newItem.quantity || 1 },
      ]
    }

    set({ items: updatedItems })

    // Track cart changes for abandoned cart recovery
    if (typeof window !== 'undefined') {
      trackCartChanges(updatedItems, get().guestEmail)
    }
  },

  /**
   * Add a mix-and-match pack at the pack price.
   *
   * The jars go in as ordinary cart lines so that inventory, shipping and tax keep seeing
   * real products, but they share a pack group and their prices add up to exactly the pack
   * price — the same split the checkout routes recompute from the catalogue. Returns false
   * when the selection is not a pack we sell, which is a bug in the caller rather than
   * something to charge the customer full price for.
   */
  addBundle: (bundleId: string, selections: BundleSelection[]) => {
    const bundle = getSalsaBundle(bundleId)
    if (!bundle || selections.length !== bundle.size) return false

    const bundleGroupId = newBundleGroupId()

    const cataloguePrices = new Map(
      selections.map((selection) => [selection.productId, selection.price])
    )

    // One line per slot, each holding a single jar. A jar chosen twice could share one line,
    // but its price would then have to round to the cent and the pack would ring up a cent
    // either side of the price it was advertised at.
    const priced = priceCartLines(
      selections.map((selection) => ({
        productId: selection.productId,
        quantity: 1,
        bundleId: bundle.id,
        bundleGroupId,
      })),
      (line) => cataloguePrices.get(line.productId) ?? 0
    )

    const bundleItems: CartItem[] = priced.map((line, index) => {
      const selection = selections[index]
      return {
        id: `${bundleGroupId}:${index}:${selection.productId}`,
        productId: selection.productId,
        name: selection.name,
        slug: selection.slug,
        price: line.unitPrice,
        image: selection.image,
        quantity: line.quantity,
        sku: selection.sku,
        heatLevel: selection.heatLevel,
        bundleId: bundle.id,
        bundleGroupId,
        bundleName: bundle.name,
      }
    })

    const updatedItems = [...get().items, ...bundleItems]
    set({ items: updatedItems })

    if (typeof window !== 'undefined') {
      trackCartChanges(updatedItems, get().guestEmail)
    }

    return true
  },

  removeItem: (id: string) => {
    const target = get().items.find((item: CartItem) => item.id === id)
    // A pack is all-or-nothing: leaving four jars of a Choose 5 behind would be a pack the
    // server refuses to price, so removing any jar removes the pack.
    const updatedItems = target?.bundleGroupId
      ? get().items.filter((item: CartItem) => item.bundleGroupId !== target.bundleGroupId)
      : get().items.filter((item: CartItem) => item.id !== id)
    set({ items: updatedItems })

    // Track cart changes for abandoned cart recovery
    if (typeof window !== 'undefined') {
      trackCartChanges(updatedItems, get().guestEmail)
    }
  },

  updateQuantity: (id: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(id)
      return
    }

    // A pack holds a fixed number of jars for its price. Changing one line's quantity would
    // leave a pack the checkout routes refuse to price, so packs are added and removed whole.
    if (get().items.find((item: CartItem) => item.id === id)?.bundleGroupId) {
      return
    }

    const updatedItems = get().items.map((item: CartItem) =>
      item.id === id
        ? { ...item, quantity: Math.min(quantity, item.maxQuantity || 99) }
        : item
    )
    set({ items: updatedItems })

    // Track cart changes for abandoned cart recovery
    if (typeof window !== 'undefined') {
      trackCartChanges(updatedItems, get().guestEmail)
    }
  },

  clearCart: () => {
    set({ items: [] })
  },

  setGuestEmail: (email: string) => {
    set({ guestEmail: email })

    // Track cart with the new email
    if (typeof window !== 'undefined' && get().items.length > 0) {
      trackCartChanges(get().items, email)
    }
  },

  openCart: () => {
    set({ isOpen: true })
  },

  closeCart: () => {
    set({ isOpen: false })
  },

  toggleCart: () => {
    set({ isOpen: !get().isOpen })
  },

  totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  totalPrice: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
})

export const useCartStore = typeof window !== 'undefined'
  ? create<CartStore>()(
      persist(cartStoreConfig, {
        name: 'cart-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ items: state.items, guestEmail: state.guestEmail }),
      })
    )
  : create<CartStore>()(cartStoreConfig)
