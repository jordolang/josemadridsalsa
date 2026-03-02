import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ComparisonNutrition {
  calories: number
  sodiumMg: number
  totalFatG: number
  totalCarbG: number
  sugarsG: number
  dietaryFiberG: number
  proteinG: number
  servingSize: string
}

export interface ComparisonProduct {
  id: string
  name: string
  slug: string
  price: number
  image: string
  heatLevel: string
  sku: string
  description: string | null
  inventory: number
  ingredients: string[] | null
  weight: string | null
  dimensions: string | null
  nutritionalInfo: ComparisonNutrition | null
}

interface ComparisonStore {
  products: ComparisonProduct[]
  isOpen: boolean

  // Actions
  addProduct: (product: ComparisonProduct) => void
  removeProduct: (id: string) => void
  clearComparison: () => void
  togglePanel: () => void
  openPanel: () => void
  closePanel: () => void
  isInComparison: (id: string) => boolean
  canAddMore: () => boolean
}

const MAX_COMPARISON = 4

const comparisonStoreConfig = (set: any, get: any): ComparisonStore => ({
  products: [],
  isOpen: false,

  addProduct: (product: ComparisonProduct) => {
    const products = get().products

    // Don't add if already exists
    if (products.find((p: ComparisonProduct) => p.id === product.id)) {
      return
    }

    // Don't add if max reached
    if (products.length >= MAX_COMPARISON) {
      return
    }

    set({ products: [...products, product] })
  },

  removeProduct: (id: string) => {
    set({
      products: get().products.filter((p: ComparisonProduct) => p.id !== id),
    })
  },

  clearComparison: () => {
    set({ products: [] })
  },

  togglePanel: () => {
    set({ isOpen: !get().isOpen })
  },

  openPanel: () => {
    set({ isOpen: true })
  },

  closePanel: () => {
    set({ isOpen: false })
  },

  isInComparison: (id: string) => {
    return get().products.some((p: ComparisonProduct) => p.id === id)
  },

  canAddMore: () => {
    return get().products.length < MAX_COMPARISON
  },
})

export const useComparisonStore = typeof window !== 'undefined'
  ? create<ComparisonStore>()(
      persist(comparisonStoreConfig, {
        name: 'comparison-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ products: state.products }),
      })
    )
  : create<ComparisonStore>()(comparisonStoreConfig)
