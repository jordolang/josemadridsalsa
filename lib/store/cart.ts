import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateCreator } from 'zustand'

export interface CartItem {
  id: string
  name: string
  slug: string
  price: number
  image: string
  quantity: number
  sku: string
  heatLevel: string
  maxQuantity?: number
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
      updatedItems = [...items, { ...newItem, quantity: newItem.quantity || 1 }]
    }

    set({ items: updatedItems })

    // Track cart changes for abandoned cart recovery
    if (typeof window !== 'undefined') {
      trackCartChanges(updatedItems, get().guestEmail)
    }
  },

  removeItem: (id: string) => {
    const updatedItems = get().items.filter((item: CartItem) => item.id !== id)
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