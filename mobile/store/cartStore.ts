/**
 * Local shopping cart state management using Zustand.
 *
 * This store manages the client-side cart for guest users and offline usage.
 * Cart data is persisted to AsyncStorage so it survives app restarts.
 *
 * For authenticated users, the server-side cart (`lib/api/cart.ts`) is the
 * source of truth. This local store acts as a fast optimistic cache.
 *
 * @module mobile/store/cartStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A single item in the shopping cart.
 *
 * Prices are stored in dollars (e.g., 8.99) to match the backend
 * API response format (Decimal converted to float).
 */
export interface CartItem {
  /** Product ID from the backend catalog */
  id: string;
  /** Display name of the product */
  name: string;
  /** Unit price in dollars (e.g., 8.99) */
  price: number;
  /** Number of units in the cart (always >= 1) */
  quantity: number;
}

/**
 * Zustand store shape for the shopping cart.
 */
interface CartState {
  /** Current items in the cart */
  items: CartItem[];
  /**
   * Add a product to the cart. If the product already exists,
   * its quantity is incremented by 1.
   * @param item - Product object with at least `id`, `name`, and `price`
   */
  addItem: (item: { id: string; name: string; price: number }) => void;
  /**
   * Remove an item from the cart entirely.
   * @param id - Product ID to remove
   */
  removeItem: (id: string) => void;
  /** Remove all items from the cart. */
  clearCart: () => void;
  /**
   * Compute the total number of units across all cart items.
   * @returns Sum of all item quantities
   */
  totalQuantity: () => number;
  /**
   * Compute the cart total in dollars.
   * @returns Sum of (price * quantity) for all items
   */
  totalPrice: () => number;
}

const cartStoreConfig: StateCreator<CartState> = (set, get) => ({
  items: [],
  addItem: (product) => set((state) => {
    const index = state.items.findIndex((i) => i.id === product.id);
    if (index >= 0) {
      return {
        items: state.items.map((item, i) =>
          i === index ? { ...item, quantity: item.quantity + 1 } : item
        ),
      };
    }
    return {
      items: [...state.items, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
    };
  }),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id)
  })),
  clearCart: () => set({ items: [] }),
  totalQuantity: () => get().items.reduce((total, item) => total + item.quantity, 0),
  totalPrice: () => get().items.reduce((total, item) => total + (item.price * item.quantity), 0)
});

/**
 * Zustand hook for shopping cart state.
 *
 * Persisted to `AsyncStorage` under the key `"cart-storage"`.
 *
 * @example
 * ```tsx
 * import { useCartStore } from '../store/cartStore';
 *
 * function MyComponent() {
 *   const addItem = useCartStore((s) => s.addItem);
 *   const count = useCartStore((s) => s.totalQuantity());
 *
 *   return <Text>Items: {count}</Text>;
 * }
 * ```
 */
export const useCartStore = create<CartState>()(
  persist(cartStoreConfig, {
    name: 'cart-storage',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
