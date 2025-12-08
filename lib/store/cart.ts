import { create } from 'zustand'
<<<<<<< HEAD
import { persist, createJSONStorage } from 'zustand/middleware'
=======
import { persist, StateStorage } from 'zustand/middleware'
>>>>>>> a914b70e48c74fb30ffafd6a685d5d84da8bcb1d

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

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void

  // Computed values
  totalItems: () => number
  totalPrice: () => number
}

const cartStoreConfig = (set: any, get: any): CartStore => ({
  items: [],
  isOpen: false,

  addItem: (newItem: any) => {
    const items = get().items
    const existingItem = items.find((item: CartItem) => item.id === newItem.id)

    if (existingItem) {
      // Update quantity if item already exists
      const newQuantity = existingItem.quantity + (newItem.quantity || 1)
      const maxQuantity = newItem.maxQuantity || 99

<<<<<<< HEAD
      removeItem: (id) => {
        set({
          items: get().items.filter((item) => item.id !== id),
        })
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id)
          return
        }

        set({
          items: get().items.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.min(quantity, item.maxQuantity || 99) }
              : item
          ),
        })
      },

      clearCart: () => {
        set({ items: [] })
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

      totalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      totalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0)
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
      storage:
        typeof window !== 'undefined'
          ? createJSONStorage(() => window.localStorage)
          : createJSONStorage(() => {
              const memoryStorage: Record<string, string> = {}
              return {
                getItem: (name: string) => memoryStorage[name] ?? null,
                setItem: (name: string, value: string) => {
                  memoryStorage[name] = value
                },
                removeItem: (name: string) => {
                  delete memoryStorage[name]
                },
              }
            }),
=======
      set({
        items: items.map((item: CartItem) =>
          item.id === newItem.id
            ? { ...item, quantity: Math.min(newQuantity, maxQuantity) }
            : item
        ),
      })
    } else {
      // Add new item
      set({
        items: [...items, { ...newItem, quantity: newItem.quantity || 1 }],
      })
>>>>>>> a914b70e48c74fb30ffafd6a685d5d84da8bcb1d
    }
  },

  removeItem: (id: string) => {
    set({
      items: get().items.filter((item: CartItem) => item.id !== id),
    })
  },

  updateQuantity: (id: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(id)
      return
    }

    set({
      items: get().items.map((item: CartItem) =>
        item.id === id
          ? { ...item, quantity: Math.min(quantity, item.maxQuantity || 99) }
          : item
      ),
    })
  },

  clearCart: () => {
    set({ items: [] })
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

  totalItems: () => {
    return get().items.reduce((total: number, item: CartItem) => total + item.quantity, 0)
  },

  totalPrice: () => {
    return get().items.reduce((total: number, item: CartItem) => total + item.price * item.quantity, 0)
  },
})

export const useCartStore = typeof window !== 'undefined'
  ? create<CartStore>()(
      persist(cartStoreConfig, {
        name: 'cart-storage',
        partialize: (state) => ({ items: state.items }),
      })
    )
  : create<CartStore>()(cartStoreConfig)