'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * The fundraising site's cart. Kept apart from the retail cart: the two sell
 * the same salsa from different BigCommerce stores at different prices, and a
 * fundraising order must carry the group it is credited to.
 *
 * Prices here are for display only; BigCommerce reprices at checkout.
 */
export type FundraisingCartLine = {
  productId: number
  name: string
  price: number
  image: string | null
  slug: string
  quantity: number
}

type FundraisingCartState = {
  lines: FundraisingCartLine[]
  /** The group the buyer is supporting, as it appears in the checkout dropdown. */
  group: string
  seller: string
  add: (line: Omit<FundraisingCartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  setGroup: (group: string) => void
  setSeller: (seller: string) => void
  clear: () => void
}

export const MAX_LINE_QUANTITY = 200

export const useFundraisingCart = create<FundraisingCartState>()(
  persist(
    (set) => ({
      lines: [],
      group: '',
      seller: '',
      add: (line, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((entry) => entry.productId === line.productId)
          if (existing) {
            return {
              lines: state.lines.map((entry) =>
                entry.productId === line.productId
                  ? { ...entry, ...line, quantity: Math.min(MAX_LINE_QUANTITY, entry.quantity + quantity) }
                  : entry,
              ),
            }
          }
          return { lines: [...state.lines, { ...line, quantity: Math.min(MAX_LINE_QUANTITY, quantity) }] }
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((entry) => entry.productId !== productId)
              : state.lines.map((entry) =>
                  entry.productId === productId ? { ...entry, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : entry,
                ),
        })),
      remove: (productId) => set((state) => ({ lines: state.lines.filter((entry) => entry.productId !== productId) })),
      setGroup: (group) => set({ group }),
      setSeller: (seller) => set({ seller }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'jms-fundraising-cart',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)

export function cartItemCount(lines: FundraisingCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function cartSubtotal(lines: FundraisingCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}
