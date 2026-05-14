import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateCreator } from 'zustand'

export interface RecentlyViewedProduct {
  id: string
  name: string
  slug: string
  price: number
  image: string
  heatLevel: string
  viewedAt: number // timestamp
}

interface RecentlyViewedStore {
  products: RecentlyViewedProduct[]

  // Actions
  addProduct: (product: Omit<RecentlyViewedProduct, 'viewedAt'>) => void
  clearHistory: () => void
  getRecent: (limit?: number) => RecentlyViewedProduct[]
}

const MAX_RECENTLY_VIEWED = 20

const recentlyViewedStoreConfig: StateCreator<RecentlyViewedStore> = (set, get) => ({
  products: [],

  addProduct: (product: Omit<RecentlyViewedProduct, 'viewedAt'>) => {
    const products = get().products
    const viewedAt = Date.now()

    // Remove if already exists
    const filtered = products.filter((p: RecentlyViewedProduct) => p.id !== product.id)

    // Add to front with timestamp
    const newProducts = [
      { ...product, viewedAt },
      ...filtered,
    ].slice(0, MAX_RECENTLY_VIEWED) // Keep only last N products

    set({ products: newProducts })
  },

  clearHistory: () => {
    set({ products: [] })
  },

  getRecent: (limit: number = 8) => {
    return get().products.slice(0, limit)
  },
})

export const useRecentlyViewedStore = typeof window !== 'undefined'
  ? create<RecentlyViewedStore>()(
      persist(recentlyViewedStoreConfig, {
        name: 'recently-viewed-storage',
        storage: createJSONStorage(() => localStorage),
      })
    )
  : create<RecentlyViewedStore>()(recentlyViewedStoreConfig)
