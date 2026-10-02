import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const createTerminalCheckout = vi.fn()

vi.mock('@/lib/prisma', () => ({ default: { product: { findMany: (...a: unknown[]) => findMany(...a) } } }))
vi.mock('@/lib/pos/terminal-checkout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pos/terminal-checkout')>()
  return { ...actual, createTerminalCheckout: (...a: unknown[]) => createTerminalCheckout(...a) }
})

import { KioskCartSchema, startKioskCheckout } from '@/lib/kiosk/checkout'
import { TerminalCheckoutError } from '@/lib/pos/terminal-checkout'

const products = [
  { id: 'p-mango', name: 'Mango Habanero Salsa', sku: 'MH', barcode: '093662452973', inventory: 9, stockReserved: 0, isActive: true },
  { id: 'p-mild', name: 'Mild', sku: 'MI', barcode: null, inventory: 9, stockReserved: 0, isActive: true },
]

beforeEach(() => {
  findMany.mockResolvedValue(products)
  createTerminalCheckout.mockReset().mockResolvedValue({ checkoutId: 'chk_1', orderId: 'o1', orderNumber: 'KIOSK-1' })
})

describe('startKioskCheckout', () => {
  it('prices the cart on the server from the booth sign', async () => {
    const result = await startKioskCheckout({
      items: [
        { key: 'mango-habanero', quantity: 3 },
        { key: 'original-mild', quantity: 1 },
      ],
    })

    expect(createTerminalCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ productId: 'p-mango', unitPriceCents: 1000, quantity: 3 }),
          expect.objectContaining({ productId: 'p-mild', unitPriceCents: 1000, quantity: 1 }),
        ],
        discountCents: 800,
        totalCents: 3200,
        orderPrefix: 'KIOSK',
        adminNotes: 'Self-order kiosk · 4-jar deal',
      })
    )
    expect(result).toMatchObject({ checkoutId: 'chk_1', quote: { totalCents: 3200, savingsCents: 800 } })
  })

  it('merges repeated lines and notes free chips', async () => {
    await startKioskCheckout({
      items: [
        { key: 'mango-habanero', quantity: 2 },
        { key: 'mango-habanero', quantity: 3 },
      ],
    })
    expect(createTerminalCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ productId: 'p-mango', quantity: 5 })],
        totalCents: 4000,
        adminNotes: 'Self-order kiosk · Show Special · 1 free bag(s) of chips',
      })
    )
  })

  it('refuses flavors it does not know or cannot sell', async () => {
    await expect(startKioskCheckout({ items: [{ key: 'nope', quantity: 1 }] })).rejects.toMatchObject({ status: 400 })
    await expect(startKioskCheckout({ items: [{ key: 'peach-mild', quantity: 1 }] })).rejects.toBeInstanceOf(
      TerminalCheckoutError
    )
    expect(createTerminalCheckout).not.toHaveBeenCalled()
  })
})

describe('KioskCartSchema', () => {
  it('ignores any price the client tries to send and rejects bad quantities', () => {
    const parsed = KioskCartSchema.parse({ items: [{ key: 'mango-habanero', quantity: 2, price: 0.01 }] })
    expect(parsed.items[0]).toEqual({ key: 'mango-habanero', quantity: 2 })
    expect(KioskCartSchema.safeParse({ items: [{ key: 'x', quantity: 0 }] }).success).toBe(false)
    expect(KioskCartSchema.safeParse({ items: [] }).success).toBe(false)
  })
})
