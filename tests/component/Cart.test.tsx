import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock cart store types
interface CartItem {
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

// Helper function to calculate total items (mimics component logic)
function calculateTotalItems(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0)
}

// Helper function to calculate total price (mimics component logic)
function calculateTotalPrice(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0)
}

// Helper function to check if cart is empty (mimics component logic)
function isCartEmpty(items: CartItem[]): boolean {
  return items.length === 0
}

// Helper function to update item quantity (mimics store logic)
function updateItemQuantity(
  items: CartItem[],
  id: string,
  quantity: number
): CartItem[] {
  // If quantity is 0 or less, remove the item
  if (quantity <= 0) {
    return items.filter((item) => item.id !== id)
  }

  // Update the quantity with maxQuantity constraint
  return items.map((item) =>
    item.id === id
      ? { ...item, quantity: Math.min(quantity, item.maxQuantity || 99) }
      : item
  )
}

// Helper function to remove item from cart (mimics store logic)
function removeItemFromCart(items: CartItem[], id: string): CartItem[] {
  return items.filter((item) => item.id !== id)
}

// Helper function to add item to cart (mimics store logic)
function addItemToCart(
  items: CartItem[],
  newItem: Omit<CartItem, 'quantity'> & { quantity?: number }
): CartItem[] {
  const existingItem = items.find((item) => item.id === newItem.id)

  if (existingItem) {
    // Update quantity if item already exists
    const newQuantity = existingItem.quantity + (newItem.quantity || 1)
    const maxQuantity = newItem.maxQuantity || 99

    return items.map((item) =>
      item.id === newItem.id
        ? { ...item, quantity: Math.min(newQuantity, maxQuantity) }
        : item
    )
  } else {
    // Add new item
    return [...items, { ...newItem, quantity: newItem.quantity || 1 }]
  }
}

// Helper function to check if quantity decrease should be disabled
function shouldDisableDecrease(quantity: number): boolean {
  return quantity <= 1
}

// Helper function to check if quantity increase should be disabled
function shouldDisableIncrease(quantity: number, maxQuantity?: number): boolean {
  return quantity >= (maxQuantity || 99)
}

describe('Cart Total Calculations', () => {
  it('should calculate total items for single item', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    expect(calculateTotalItems(items)).toBe(2)
  })

  it('should calculate total items for multiple items', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
      {
        id: '2',
        name: 'Salsa Roja',
        slug: 'salsa-roja',
        price: 8.99,
        image: '/images/salsa.jpg',
        quantity: 3,
        sku: 'SALSA-002',
        heatLevel: 'hot',
      },
    ]

    expect(calculateTotalItems(items)).toBe(5)
  })

  it('should return 0 for empty cart', () => {
    const items: CartItem[] = []
    expect(calculateTotalItems(items)).toBe(0)
  })

  it('should calculate total price for single item', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    expect(calculateTotalPrice(items)).toBe(19.98)
  })

  it('should calculate total price for multiple items', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
      {
        id: '2',
        name: 'Salsa Roja',
        slug: 'salsa-roja',
        price: 10.0,
        image: '/images/salsa.jpg',
        quantity: 3,
        sku: 'SALSA-002',
        heatLevel: 'hot',
      },
    ]

    expect(calculateTotalPrice(items)).toBeCloseTo(49.98, 2)
  })

  it('should return 0 for empty cart price', () => {
    const items: CartItem[] = []
    expect(calculateTotalPrice(items)).toBe(0)
  })

  it('should handle decimal prices correctly', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 12.5,
        image: '/images/salsa.jpg',
        quantity: 3,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    expect(calculateTotalPrice(items)).toBe(37.5)
  })
})

describe('Cart Empty State', () => {
  it('should detect empty cart', () => {
    const items: CartItem[] = []
    expect(isCartEmpty(items)).toBe(true)
  })

  it('should detect non-empty cart', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 1,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]
    expect(isCartEmpty(items)).toBe(false)
  })
})

describe('Cart Quantity Updates', () => {
  it('should increase item quantity', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const updatedItems = updateItemQuantity(items, '1', 3)
    expect(updatedItems[0].quantity).toBe(3)
  })

  it('should decrease item quantity', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 3,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const updatedItems = updateItemQuantity(items, '1', 2)
    expect(updatedItems[0].quantity).toBe(2)
  })

  it('should remove item when quantity is 0', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 1,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const updatedItems = updateItemQuantity(items, '1', 0)
    expect(updatedItems).toHaveLength(0)
  })

  it('should remove item when quantity is negative', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 1,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const updatedItems = updateItemQuantity(items, '1', -1)
    expect(updatedItems).toHaveLength(0)
  })

  it('should respect maxQuantity constraint', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 5,
        sku: 'SALSA-001',
        heatLevel: 'medium',
        maxQuantity: 5,
      },
    ]

    const updatedItems = updateItemQuantity(items, '1', 10)
    expect(updatedItems[0].quantity).toBe(5)
  })

  it('should use default maxQuantity of 99 when not specified', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 50,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const updatedItems = updateItemQuantity(items, '1', 100)
    expect(updatedItems[0].quantity).toBe(99)
  })

  it('should not affect other items when updating quantity', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
      {
        id: '2',
        name: 'Salsa Roja',
        slug: 'salsa-roja',
        price: 8.99,
        image: '/images/salsa.jpg',
        quantity: 3,
        sku: 'SALSA-002',
        heatLevel: 'hot',
      },
    ]

    const updatedItems = updateItemQuantity(items, '1', 5)
    expect(updatedItems[0].quantity).toBe(5)
    expect(updatedItems[1].quantity).toBe(3)
  })
})

describe('Cart Item Removal', () => {
  it('should remove item from cart', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const updatedItems = removeItemFromCart(items, '1')
    expect(updatedItems).toHaveLength(0)
  })

  it('should only remove specified item', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
      {
        id: '2',
        name: 'Salsa Roja',
        slug: 'salsa-roja',
        price: 8.99,
        image: '/images/salsa.jpg',
        quantity: 3,
        sku: 'SALSA-002',
        heatLevel: 'hot',
      },
    ]

    const updatedItems = removeItemFromCart(items, '1')
    expect(updatedItems).toHaveLength(1)
    expect(updatedItems[0].id).toBe('2')
  })

  it('should handle removing non-existent item', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const updatedItems = removeItemFromCart(items, 'non-existent')
    expect(updatedItems).toHaveLength(1)
  })
})

describe('Cart Add Item Logic', () => {
  it('should add new item to empty cart', () => {
    const items: CartItem[] = []
    const newItem = {
      id: '1',
      name: 'Salsa Verde',
      slug: 'salsa-verde',
      price: 9.99,
      image: '/images/salsa.jpg',
      sku: 'SALSA-001',
      heatLevel: 'medium',
    }

    const updatedItems = addItemToCart(items, newItem)
    expect(updatedItems).toHaveLength(1)
    expect(updatedItems[0].quantity).toBe(1)
  })

  it('should add new item with specified quantity', () => {
    const items: CartItem[] = []
    const newItem = {
      id: '1',
      name: 'Salsa Verde',
      slug: 'salsa-verde',
      price: 9.99,
      image: '/images/salsa.jpg',
      sku: 'SALSA-001',
      heatLevel: 'medium',
      quantity: 3,
    }

    const updatedItems = addItemToCart(items, newItem)
    expect(updatedItems).toHaveLength(1)
    expect(updatedItems[0].quantity).toBe(3)
  })

  it('should increment quantity for existing item', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const newItem = {
      id: '1',
      name: 'Salsa Verde',
      slug: 'salsa-verde',
      price: 9.99,
      image: '/images/salsa.jpg',
      sku: 'SALSA-001',
      heatLevel: 'medium',
    }

    const updatedItems = addItemToCart(items, newItem)
    expect(updatedItems).toHaveLength(1)
    expect(updatedItems[0].quantity).toBe(3)
  })

  it('should respect maxQuantity when adding to existing item', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 4,
        sku: 'SALSA-001',
        heatLevel: 'medium',
        maxQuantity: 5,
      },
    ]

    const newItem = {
      id: '1',
      name: 'Salsa Verde',
      slug: 'salsa-verde',
      price: 9.99,
      image: '/images/salsa.jpg',
      sku: 'SALSA-001',
      heatLevel: 'medium',
      maxQuantity: 5,
      quantity: 3,
    }

    const updatedItems = addItemToCart(items, newItem)
    expect(updatedItems[0].quantity).toBe(5)
  })

  it('should add different items separately', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 2,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    const newItem = {
      id: '2',
      name: 'Salsa Roja',
      slug: 'salsa-roja',
      price: 8.99,
      image: '/images/salsa.jpg',
      sku: 'SALSA-002',
      heatLevel: 'hot',
    }

    const updatedItems = addItemToCart(items, newItem)
    expect(updatedItems).toHaveLength(2)
  })
})

describe('Cart Button States', () => {
  it('should disable decrease button at quantity 1', () => {
    expect(shouldDisableDecrease(1)).toBe(true)
  })

  it('should enable decrease button above quantity 1', () => {
    expect(shouldDisableDecrease(2)).toBe(false)
    expect(shouldDisableDecrease(10)).toBe(false)
  })

  it('should disable increase button at maxQuantity', () => {
    expect(shouldDisableIncrease(5, 5)).toBe(true)
  })

  it('should enable increase button below maxQuantity', () => {
    expect(shouldDisableIncrease(4, 5)).toBe(false)
  })

  it('should disable increase button at default maxQuantity of 99', () => {
    expect(shouldDisableIncrease(99)).toBe(true)
  })

  it('should enable increase button below default maxQuantity', () => {
    expect(shouldDisableIncrease(50)).toBe(false)
  })
})

describe('Cart Edge Cases', () => {
  it('should handle very high quantities', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 99,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    expect(calculateTotalItems(items)).toBe(99)
    expect(calculateTotalPrice(items)).toBe(989.01)
  })

  it('should handle very small prices', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Sample',
        slug: 'sample',
        price: 0.01,
        image: '/images/salsa.jpg',
        quantity: 10,
        sku: 'SAMPLE-001',
        heatLevel: 'mild',
      },
    ]

    expect(calculateTotalPrice(items)).toBeCloseTo(0.1, 2)
  })

  it('should handle zero price items', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Free Sample',
        slug: 'free-sample',
        price: 0,
        image: '/images/salsa.jpg',
        quantity: 5,
        sku: 'FREE-001',
        heatLevel: 'mild',
      },
    ]

    expect(calculateTotalPrice(items)).toBe(0)
  })

  it('should handle cart with single quantity item', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 1,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
    ]

    expect(calculateTotalItems(items)).toBe(1)
    expect(shouldDisableDecrease(items[0].quantity)).toBe(true)
  })

  it('should handle multiple items at different quantities', () => {
    const items: CartItem[] = [
      {
        id: '1',
        name: 'Salsa Verde',
        slug: 'salsa-verde',
        price: 9.99,
        image: '/images/salsa.jpg',
        quantity: 1,
        sku: 'SALSA-001',
        heatLevel: 'medium',
      },
      {
        id: '2',
        name: 'Salsa Roja',
        slug: 'salsa-roja',
        price: 8.99,
        image: '/images/salsa.jpg',
        quantity: 5,
        sku: 'SALSA-002',
        heatLevel: 'hot',
      },
      {
        id: '3',
        name: 'Salsa Habanero',
        slug: 'salsa-habanero',
        price: 12.99,
        image: '/images/salsa.jpg',
        quantity: 3,
        sku: 'SALSA-003',
        heatLevel: 'extra-hot',
      },
    ]

    expect(calculateTotalItems(items)).toBe(9)
    expect(calculateTotalPrice(items)).toBeCloseTo(93.91, 2)
  })
})
