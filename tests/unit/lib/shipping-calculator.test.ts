/**
 * Shipping Calculator Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import {
  calculateShipping,
  getShippingEstimate,
  validateShippingAddress,
} from '@/lib/shipping-calculator'

describe('Shipping Calculator', () => {
  describe('calculateShipping', () => {
    it('should return free shipping for orders over $50', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 75.0,
      })

      expect(result).toMatchObject({
        shippingCost: 0,
        shippingMethod: 'Free Shipping',
        estimatedDelivery: '3-5 business days',
      })
    })

    it('should return free shipping for orders exactly at $50 threshold', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 50.0,
      })

      expect(result).toMatchObject({
        shippingCost: 0,
        shippingMethod: 'Free Shipping',
      })
    })

    it('should calculate flat rate shipping for domestic orders', () => {
      const result = calculateShipping({
        items: [{ quantity: 2, weight: 1 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 25.0,
      })

      expect(result).toMatchObject({
        shippingCost: 6.99,
        shippingMethod: 'Standard Shipping',
        estimatedDelivery: '3-5 business days',
      })
      expect(result.availableOptions).toBeDefined()
      expect(result.availableOptions).toHaveLength(2)
    })

    it('should calculate international shipping for non-US orders', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'ON',
          postalCode: 'M5H 2N2',
          country: 'CA',
        },
        subtotal: 30.0,
      })

      expect(result).toMatchObject({
        shippingCost: 24.99,
        shippingMethod: 'International Shipping',
        estimatedDelivery: '7-14 business days',
      })
    })

    it('should apply weight-based pricing for heavy orders', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 10 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Total weight: 10 lbs
      // Weight-based: $4.99 + (10 - 5) * $0.50 = $4.99 + $2.50 = $7.49
      // Flat rate: $6.99
      // Should use max: $7.49
      expect(result.shippingCost).toBe(7.49)
      expect(result.shippingMethod).toBe('Standard Shipping')
    })

    it('should use default weight of 1 lb if weight not specified', () => {
      const result = calculateShipping({
        items: [{ quantity: 3 }],
        shippingAddress: {
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        subtotal: 20.0,
      })

      // Total weight: 3 items * 1 lb = 3 lbs (below 5 lb threshold)
      expect(result.shippingCost).toBe(6.99)
    })

    it('should apply state multiplier for Alaska', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'AK',
          postalCode: '99501',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Flat rate $6.99 * 1.5 = $10.485 rounded to $10.48
      expect(result.shippingCost).toBe(10.48)
      expect(result.availableOptions?.[0].cost).toBe(10.48)
    })

    it('should apply state multiplier for Hawaii', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'HI',
          postalCode: '96801',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Flat rate $6.99 * 1.5 = $10.485 rounded to $10.48
      expect(result.shippingCost).toBe(10.48)
    })

    it('should apply state multiplier for Puerto Rico', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'PR',
          postalCode: '00901',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Flat rate $6.99 * 2.0 = $13.98
      expect(result.shippingCost).toBe(13.98)
    })

    it('should handle lowercase state codes', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'ak',
          postalCode: '99501',
          country: 'US',
        },
        subtotal: 30.0,
      })

      expect(result.shippingCost).toBe(10.48)
    })

    it('should return available shipping options', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 30.0,
      })

      expect(result.availableOptions).toHaveLength(2)
      expect(result.availableOptions?.[0]).toMatchObject({
        method: 'Standard Shipping',
        cost: 6.99,
        estimatedDays: '3-5 business days',
      })
      expect(result.availableOptions?.[1]).toMatchObject({
        method: 'Express Shipping',
        cost: 14.99,
        estimatedDays: '1-2 business days',
      })
    })

    it('should offer free express shipping when express cost exceeds subtotal', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 10.0,
      })

      expect(result.availableOptions?.[1]).toMatchObject({
        method: 'Express Shipping',
        cost: 0,
        estimatedDays: '1-2 business days',
      })
    })

    it('should apply state multiplier to express shipping', () => {
      const result = calculateShipping({
        items: [{ quantity: 1, weight: 2 }],
        shippingAddress: {
          state: 'AK',
          postalCode: '99501',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Express $14.99 * 1.5 = $22.485 (not rounded in availableOptions)
      expect(result.availableOptions?.[1].cost).toBe(22.485)
    })

    it('should handle multiple items with different weights', () => {
      const result = calculateShipping({
        items: [
          { quantity: 2, weight: 1.5 }, // 3 lbs
          { quantity: 1, weight: 3 }, // 3 lbs
        ],
        shippingAddress: {
          state: 'TX',
          postalCode: '75001',
          country: 'US',
        },
        subtotal: 40.0,
      })

      // Total weight: 6 lbs
      // Weight-based: $4.99 + (6 - 5) * $0.50 = $5.49
      // Flat rate: $6.99
      // Should use max: $6.99
      expect(result.shippingCost).toBe(6.99)
    })
  })

  describe('getShippingEstimate', () => {
    it('should return 0 for orders over free shipping threshold', () => {
      const estimate = getShippingEstimate({
        subtotal: 75.0,
        state: 'CA',
        country: 'US',
      })

      expect(estimate).toBe(0)
    })

    it('should return 0 for orders exactly at threshold', () => {
      const estimate = getShippingEstimate({
        subtotal: 50.0,
        state: 'CA',
        country: 'US',
      })

      expect(estimate).toBe(0)
    })

    it('should return international rate for non-US countries', () => {
      const estimate = getShippingEstimate({
        subtotal: 30.0,
        state: 'ON',
        country: 'CA',
      })

      expect(estimate).toBe(24.99)
    })

    it('should return flat rate for standard US states', () => {
      const estimate = getShippingEstimate({
        subtotal: 30.0,
        state: 'CA',
        country: 'US',
      })

      expect(estimate).toBe(6.99)
    })

    it('should apply state multiplier for Alaska', () => {
      const estimate = getShippingEstimate({
        subtotal: 30.0,
        state: 'AK',
        country: 'US',
      })

      expect(estimate).toBe(10.48)
    })

    it('should apply state multiplier for Hawaii', () => {
      const estimate = getShippingEstimate({
        subtotal: 30.0,
        state: 'HI',
        country: 'US',
      })

      expect(estimate).toBe(10.48)
    })

    it('should apply state multiplier for Puerto Rico', () => {
      const estimate = getShippingEstimate({
        subtotal: 30.0,
        state: 'PR',
        country: 'US',
      })

      expect(estimate).toBe(13.98)
    })

    it('should default to US when country is not specified', () => {
      const estimate = getShippingEstimate({
        subtotal: 30.0,
        state: 'NY',
      })

      expect(estimate).toBe(6.99)
    })

    it('should handle lowercase state codes', () => {
      const estimate = getShippingEstimate({
        subtotal: 30.0,
        state: 'hi',
        country: 'US',
      })

      expect(estimate).toBe(10.48)
    })
  })

  describe('validateShippingAddress', () => {
    it('should validate a correct address', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should reject missing address1', () => {
      const result = validateShippingAddress({
        address1: '',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Address line 1 is required')
    })

    it('should reject short address1', () => {
      const result = validateShippingAddress({
        address1: 'Ab',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Address line 1 is required')
    })

    it('should reject missing city', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: '',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('City is required')
    })

    it('should reject short city', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'A',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('City is required')
    })

    it('should reject invalid state code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'California',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('State must be a 2-letter code (e.g., CA, NY)')
    })

    it('should reject missing state', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: '',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('State must be a 2-letter code (e.g., CA, NY)')
    })

    it('should reject invalid postal code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '123',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Valid ZIP code is required')
    })

    it('should reject missing postal code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Valid ZIP code is required')
    })

    it('should reject invalid country code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'USA',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Country must be a 2-letter code (e.g., US)')
    })

    it('should reject missing country', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: '',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Country must be a 2-letter code (e.g., US)')
    })

    it('should return multiple errors for completely invalid address', () => {
      const result = validateShippingAddress({
        address1: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(5)
    })

    it('should accept valid international address', () => {
      const result = validateShippingAddress({
        address1: '10 Downing Street',
        city: 'London',
        state: 'EN',
        postalCode: 'SW1A 2AA',
        country: 'GB',
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })
  })
})
