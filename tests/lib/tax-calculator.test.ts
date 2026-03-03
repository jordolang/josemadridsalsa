/**
 * Tax Calculator Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateTax } from '@/lib/tax-calculator'
import { prisma } from '@/lib/prisma'

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    tax: {
      calculations: {
        create: vi.fn().mockResolvedValue({
          tax_amount_exclusive: 850, // $8.50 in cents
          tax_breakdown: [
            {
              jurisdiction: { display_name: 'California' },
              tax_rate_details: { percentage_decimal: '8.5' },
              tax_amount: 850,
            },
          ],
        }),
      },
    },
  }),
}))

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Tax Calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateTax', () => {
    it('should calculate tax for a basic order', async () => {
      // Mock no wholesale account (not tax exempt)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await calculateTax({
        lineItems: [
          {
            amount: 10000, // $100.00 in cents
            reference: 'product-1',
            taxCode: 'txcd_30011000',
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
      })

      expect(result).toMatchObject({
        taxAmount: 850,
        taxAmountDecimal: 8.5,
        taxRate: 8.5,
        taxExempt: false,
      })
      expect(result.taxBreakdown).toHaveLength(1)
    })

    it('should return zero tax for tax-exempt wholesale customers', async () => {
      // Mock approved wholesale account with resale number
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'wholesale@example.com',
        wholesaleAccount: {
          id: 'wholesale-1',
          userId: 'user-1',
          status: 'APPROVED',
          resaleNumber: 'RN-12345',
          businessName: 'Test Business',
          businessType: 'RESTAURANT',
          contactName: 'John Doe',
          yearsInBusiness: 5,
          estimatedVolume: '10000',
          approvedAt: new Date(),
          approvedBy: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any)

      const result = await calculateTax({
        lineItems: [
          {
            amount: 10000,
            reference: 'product-1',
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        customerEmail: 'wholesale@example.com',
      })

      expect(result).toMatchObject({
        taxAmount: 0,
        taxAmountDecimal: 0,
        taxRate: 0,
        taxExempt: true,
      })
      expect(result.taxBreakdown).toEqual([])
    })

    it('should not exempt wholesale customers without resale number', async () => {
      // Mock approved wholesale account WITHOUT resale number
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'wholesale@example.com',
        wholesaleAccount: {
          id: 'wholesale-1',
          userId: 'user-1',
          status: 'APPROVED',
          resaleNumber: null, // No resale number
          businessName: 'Test Business',
          businessType: 'RESTAURANT',
          contactName: 'John Doe',
          yearsInBusiness: 5,
          estimatedVolume: '10000',
          approvedAt: new Date(),
          approvedBy: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any)

      const result = await calculateTax({
        lineItems: [
          {
            amount: 10000,
            reference: 'product-1',
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        customerEmail: 'wholesale@example.com',
      })

      expect(result.taxExempt).toBe(false)
      expect(result.taxAmount).toBe(850)
    })

    it('should not exempt pending wholesale accounts', async () => {
      // Mock PENDING wholesale account
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'wholesale@example.com',
        wholesaleAccount: {
          id: 'wholesale-1',
          userId: 'user-1',
          status: 'PENDING', // Not approved yet
          resaleNumber: 'RN-12345',
          businessName: 'Test Business',
          businessType: 'RESTAURANT',
          contactName: 'John Doe',
          yearsInBusiness: 5,
          estimatedVolume: '10000',
          approvedAt: null,
          approvedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any)

      const result = await calculateTax({
        lineItems: [
          {
            amount: 10000,
            reference: 'product-1',
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        customerEmail: 'wholesale@example.com',
      })

      expect(result.taxExempt).toBe(false)
      expect(result.taxAmount).toBe(850)
    })

    it('should handle missing customer email gracefully', async () => {
      const result = await calculateTax({
        lineItems: [
          {
            amount: 10000,
            reference: 'product-1',
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        // No customerEmail provided
      })

      expect(result.taxExempt).toBe(false)
      expect(result.taxAmount).toBe(850)
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })
  })
})
