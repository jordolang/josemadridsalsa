import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateCreator } from 'zustand'

export interface WishlistItem {
  id: string // WishlistItem.id from database
  productId: string // Product.id
  name: string
  slug: string
  price: number
  compareAtPrice?: number | null
  image: string // featuredImage
  heatLevel: string
  sku: string
  inventory: number
  isActive: boolean
  addedAt: Date // createdAt
}

export interface WishlistStore {
  items: WishlistItem[]
  isLoading: boolean

  // Actions
  addItem: (productId: string) => Promise<void>
  removeItem: (productId: string) => Promise<void>
  isInWishlist: (productId: string) => boolean
  clearWishlist: () => void
  fetchWishlist: () => Promise<void>

  // Computed
  totalItems: () => number
}

const wishlistStoreConfig: StateCreator<WishlistStore> = (set, get) => ({
  items: [],
  isLoading: false,

  addItem: async (productId: string) => {
    const currentItems = get().items

    // Check if already in wishlist
    if (currentItems.some((item: WishlistItem) => item.productId === productId)) {
      return
    }

    // Optimistic update - add temporary item
    const tempItem: WishlistItem = {
      id: `temp-${productId}`,
      productId,
      name: 'Loading...',
      slug: '',
      price: 0,
      image: '',
      heatLevel: '',
      sku: '',
      inventory: 0,
      isActive: true,
      addedAt: new Date(),
    }

    set({ items: [...currentItems, tempItem] })

    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add to wishlist')
      }

      // Update with real data from API
      const realItem: WishlistItem = {
        id: data.id,
        productId: data.product.id,
        name: data.product.name,
        slug: data.product.slug,
        price: data.product.price,
        compareAtPrice: data.product.compareAtPrice,
        image: data.product.featuredImage,
        heatLevel: data.product.heatLevel,
        sku: data.product.sku,
        inventory: data.product.inventory,
        isActive: data.product.isActive,
        addedAt: new Date(data.createdAt),
      }

      set({
        items: currentItems
          .filter((item: WishlistItem) => item.productId !== productId)
          .concat(realItem),
      })
    } catch (error) {
      // Revert optimistic update
      set({ items: currentItems.filter((item: WishlistItem) => item.productId !== productId) })
      console.error('Failed to add to wishlist:', error)
    }
  },

  removeItem: async (productId: string) => {
    const currentItems = get().items

    // Optimistic update - remove immediately
    set({ items: currentItems.filter((item: WishlistItem) => item.productId !== productId) })

    try {
      const response = await fetch('/api/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove from wishlist')
      }
    } catch (error) {
      // Revert optimistic update
      set({ items: currentItems })
      console.error('Failed to remove from wishlist:', error)
    }
  },

  isInWishlist: (productId: string) => {
    return get().items.some((item: WishlistItem) => item.productId === productId)
  },

  clearWishlist: () => {
    set({ items: [] })
  },

  fetchWishlist: async () => {
    set({ isLoading: true })

    try {
      const response = await fetch('/api/wishlist', {
        credentials: 'include',
      })

      if (!response.ok) {
        // If unauthorized, just clear the wishlist silently (don't log error)
        if (response.status === 401 || response.status === 403) {
          set({ items: [], isLoading: false })
          return
        }

        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch wishlist')
      }

      const data = await response.json()
      const items: WishlistItem[] = data.items.map((item: {
        id: string
        product: {
          id: string
          name: string
          slug: string
          price: number
          compareAtPrice?: number | null
          featuredImage: string
          heatLevel: string
          sku: string
          inventory: number
          isActive: boolean
        }
        createdAt: string
      }) => ({
        id: item.id,
        productId: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        compareAtPrice: item.product.compareAtPrice,
        image: item.product.featuredImage,
        heatLevel: item.product.heatLevel,
        sku: item.product.sku,
        inventory: item.product.inventory,
        isActive: item.product.isActive,
        addedAt: new Date(item.createdAt),
      }))

      set({ items, isLoading: false })
    } catch (error) {
      // Only log non-authentication errors
      if (error instanceof Error && error.message && !error.message.includes('401') && !error.message.includes('403')) {
        console.error('Failed to fetch wishlist:', error)
      }
      set({ items: [], isLoading: false })
    }
  },

  totalItems: () => {
    return get().items.length
  },
})

// Create store with persistence (localStorage)
export const useWishlistStore =
  typeof window !== 'undefined'
    ? create<WishlistStore>()(
        persist(wishlistStoreConfig, {
          name: 'wishlist-storage',
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({ items: state.items }),
        })
      )
    : create<WishlistStore>()(wishlistStoreConfig)
