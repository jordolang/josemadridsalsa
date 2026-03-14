/**
 * Validation Schema Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import {
  RoleEnum,
  HeatLevelEnum,
  UserCreateSchema,
  UserSetPasswordSchema,
  CategoryCreateSchema,
  ProductBaseSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  MessageStartSchema,
  AdminReplySchema,
  RefundRequestSchema,
} from '@/lib/validation'

describe('Validation Schemas', () => {
  describe('RoleEnum', () => {
    it('should accept valid roles', () => {
      expect(RoleEnum.parse('ADMIN')).toBe('ADMIN')
      expect(RoleEnum.parse('CUSTOMER')).toBe('CUSTOMER')
      expect(RoleEnum.parse('WHOLESALE')).toBe('WHOLESALE')
    })

    it('should reject invalid roles', () => {
      expect(() => RoleEnum.parse('INVALID')).toThrow()
      expect(() => RoleEnum.parse('admin')).toThrow()
      expect(() => RoleEnum.parse('')).toThrow()
    })
  })

  describe('HeatLevelEnum', () => {
    it('should accept valid heat levels', () => {
      expect(HeatLevelEnum.parse('MILD')).toBe('MILD')
      expect(HeatLevelEnum.parse('MEDIUM')).toBe('MEDIUM')
      expect(HeatLevelEnum.parse('HOT')).toBe('HOT')
      expect(HeatLevelEnum.parse('EXTRA_HOT')).toBe('EXTRA_HOT')
      expect(HeatLevelEnum.parse('FRUIT')).toBe('FRUIT')
    })

    it('should reject invalid heat levels', () => {
      expect(() => HeatLevelEnum.parse('SUPER_HOT')).toThrow()
      expect(() => HeatLevelEnum.parse('mild')).toThrow()
      expect(() => HeatLevelEnum.parse('')).toThrow()
    })
  })

  describe('UserCreateSchema', () => {
    it('should accept valid user data', () => {
      const validUser = {
        email: 'test@example.com',
        name: 'John Doe',
        role: 'CUSTOMER',
        password: 'password123',
      }
      expect(UserCreateSchema.parse(validUser)).toMatchObject(validUser)
    })

    it('should accept user without name', () => {
      const userWithoutName = {
        email: 'test@example.com',
        role: 'ADMIN',
        password: 'password123',
      }
      expect(UserCreateSchema.parse(userWithoutName)).toMatchObject(userWithoutName)
    })

    it('should accept empty string as name', () => {
      const userWithEmptyName = {
        email: 'test@example.com',
        name: '',
        role: 'WHOLESALE',
        password: 'password123',
      }
      expect(UserCreateSchema.parse(userWithEmptyName)).toMatchObject(userWithEmptyName)
    })

    it('should reject invalid email', () => {
      const invalidUser = {
        email: 'not-an-email',
        role: 'CUSTOMER',
        password: 'password123',
      }
      expect(() => UserCreateSchema.parse(invalidUser)).toThrow()
    })

    it('should reject short password', () => {
      const invalidUser = {
        email: 'test@example.com',
        role: 'CUSTOMER',
        password: 'short',
      }
      expect(() => UserCreateSchema.parse(invalidUser)).toThrow()
    })

    it('should reject invalid role', () => {
      const invalidUser = {
        email: 'test@example.com',
        role: 'INVALID',
        password: 'password123',
      }
      expect(() => UserCreateSchema.parse(invalidUser)).toThrow()
    })

    it('should reject missing required fields', () => {
      expect(() => UserCreateSchema.parse({})).toThrow()
      expect(() => UserCreateSchema.parse({ email: 'test@example.com' })).toThrow()
    })
  })

  describe('UserSetPasswordSchema', () => {
    it('should accept valid password update', () => {
      const validData = {
        userId: 'user-123',
        password: 'newpassword123',
      }
      expect(UserSetPasswordSchema.parse(validData)).toMatchObject(validData)
    })

    it('should reject short password', () => {
      const invalidData = {
        userId: 'user-123',
        password: 'short',
      }
      expect(() => UserSetPasswordSchema.parse(invalidData)).toThrow()
    })

    it('should reject empty userId', () => {
      const invalidData = {
        userId: '',
        password: 'password123',
      }
      expect(() => UserSetPasswordSchema.parse(invalidData)).toThrow()
    })

    it('should reject missing fields', () => {
      expect(() => UserSetPasswordSchema.parse({ userId: 'user-123' })).toThrow()
      expect(() => UserSetPasswordSchema.parse({ password: 'password123' })).toThrow()
    })
  })

  describe('CategoryCreateSchema', () => {
    it('should accept valid category data', () => {
      const validCategory = {
        name: 'Hot Sauces',
        slug: 'hot-sauces',
      }
      expect(CategoryCreateSchema.parse(validCategory)).toMatchObject(validCategory)
    })

    it('should reject empty name', () => {
      const invalidCategory = {
        name: '',
        slug: 'hot-sauces',
      }
      expect(() => CategoryCreateSchema.parse(invalidCategory)).toThrow()
    })

    it('should reject empty slug', () => {
      const invalidCategory = {
        name: 'Hot Sauces',
        slug: '',
      }
      expect(() => CategoryCreateSchema.parse(invalidCategory)).toThrow()
    })

    it('should reject missing fields', () => {
      expect(() => CategoryCreateSchema.parse({ name: 'Hot Sauces' })).toThrow()
      expect(() => CategoryCreateSchema.parse({ slug: 'hot-sauces' })).toThrow()
    })
  })

  describe('ProductBaseSchema', () => {
    const validProduct = {
      name: 'Ghost Pepper Salsa',
      slug: 'ghost-pepper-salsa',
      description: 'Very hot salsa',
      price: 12.99,
      compareAtPrice: 15.99,
      sku: 'GPS-001',
      inventory: 50,
      heatLevel: 'EXTRA_HOT',
      categoryId: 'cat-123',
      isActive: true,
      isFeatured: false,
      featuredImage: 'image.jpg',
      images: ['image1.jpg', 'image2.jpg'],
      metaTitle: 'Ghost Pepper Salsa - Hot Sauce',
      metaDescription: 'Extremely spicy ghost pepper salsa made with fresh ingredients',
      searchKeywords: ['ghost pepper', 'hot', 'salsa'],
    }

    it('should accept valid product data', () => {
      expect(ProductBaseSchema.parse(validProduct)).toMatchObject(validProduct)
    })

    it('should accept minimal required fields', () => {
      const minimalProduct = {
        name: 'Salsa',
        slug: 'salsa',
        price: 10.00,
        sku: 'SKU-001',
        inventory: 10,
        heatLevel: 'MILD',
        categoryId: 'cat-123',
      }
      const result = ProductBaseSchema.parse(minimalProduct)
      expect(result.name).toBe('Salsa')
      expect(result.isActive).toBe(false)
      expect(result.isFeatured).toBe(false)
      expect(result.images).toEqual([])
      expect(result.searchKeywords).toEqual([])
    })

    it('should coerce price to number', () => {
      const productWithStringPrice = {
        ...validProduct,
        price: '12.99',
      }
      const result = ProductBaseSchema.parse(productWithStringPrice)
      expect(result.price).toBe(12.99)
      expect(typeof result.price).toBe('number')
    })

    it('should coerce inventory to integer', () => {
      const productWithStringInventory = {
        ...validProduct,
        inventory: '50',
      }
      const result = ProductBaseSchema.parse(productWithStringInventory)
      expect(result.inventory).toBe(50)
      expect(typeof result.inventory).toBe('number')
    })

    it('should accept null compareAtPrice', () => {
      const productWithNullCompare = {
        ...validProduct,
        compareAtPrice: null,
      }
      expect(ProductBaseSchema.parse(productWithNullCompare)).toMatchObject(productWithNullCompare)
    })

    it('should accept empty string for optional fields', () => {
      const productWithEmptyStrings = {
        ...validProduct,
        description: '',
        featuredImage: '',
        metaTitle: '',
        metaDescription: '',
      }
      expect(ProductBaseSchema.parse(productWithEmptyStrings)).toMatchObject(productWithEmptyStrings)
    })

    it('should reject negative price', () => {
      const invalidProduct = {
        ...validProduct,
        price: -10,
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject negative inventory', () => {
      const invalidProduct = {
        ...validProduct,
        inventory: -5,
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject non-integer inventory', () => {
      const invalidProduct = {
        ...validProduct,
        inventory: 10.5,
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject empty name', () => {
      const invalidProduct = {
        ...validProduct,
        name: '',
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject empty slug', () => {
      const invalidProduct = {
        ...validProduct,
        slug: '',
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject empty sku', () => {
      const invalidProduct = {
        ...validProduct,
        sku: '',
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject empty categoryId', () => {
      const invalidProduct = {
        ...validProduct,
        categoryId: '',
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject invalid heatLevel', () => {
      const invalidProduct = {
        ...validProduct,
        heatLevel: 'INVALID',
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject metaTitle over 70 characters', () => {
      const invalidProduct = {
        ...validProduct,
        metaTitle: 'A'.repeat(71),
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should reject metaDescription over 160 characters', () => {
      const invalidProduct = {
        ...validProduct,
        metaDescription: 'A'.repeat(161),
      }
      expect(() => ProductBaseSchema.parse(invalidProduct)).toThrow()
    })

    it('should accept metaTitle at exactly 70 characters', () => {
      const productWithMaxTitle = {
        ...validProduct,
        metaTitle: 'A'.repeat(70),
      }
      expect(ProductBaseSchema.parse(productWithMaxTitle).metaTitle).toHaveLength(70)
    })

    it('should accept metaDescription at exactly 160 characters', () => {
      const productWithMaxDesc = {
        ...validProduct,
        metaDescription: 'A'.repeat(160),
      }
      expect(ProductBaseSchema.parse(productWithMaxDesc).metaDescription).toHaveLength(160)
    })
  })

  describe('ProductCreateSchema', () => {
    it('should use ProductBaseSchema', () => {
      const validProduct = {
        name: 'Salsa',
        slug: 'salsa',
        price: 10.00,
        sku: 'SKU-001',
        inventory: 10,
        heatLevel: 'MILD',
        categoryId: 'cat-123',
      }
      expect(ProductCreateSchema.parse(validProduct)).toMatchObject(validProduct)
    })
  })

  describe('ProductUpdateSchema', () => {
    it('should use ProductBaseSchema', () => {
      const validProduct = {
        name: 'Updated Salsa',
        slug: 'updated-salsa',
        price: 15.00,
        sku: 'SKU-002',
        inventory: 20,
        heatLevel: 'HOT',
        categoryId: 'cat-456',
      }
      expect(ProductUpdateSchema.parse(validProduct)).toMatchObject(validProduct)
    })
  })

  describe('MessageStartSchema', () => {
    it('should accept valid message data', () => {
      const validMessage = {
        subject: 'Question about order',
        message: 'When will my order ship?',
        email: 'customer@example.com',
      }
      expect(MessageStartSchema.parse(validMessage)).toMatchObject(validMessage)
    })

    it('should accept message without subject', () => {
      const messageWithoutSubject = {
        message: 'This is a message',
        email: 'customer@example.com',
      }
      expect(MessageStartSchema.parse(messageWithoutSubject)).toMatchObject(messageWithoutSubject)
    })

    it('should accept message without email', () => {
      const messageWithoutEmail = {
        subject: 'Question',
        message: 'This is a message',
      }
      expect(MessageStartSchema.parse(messageWithoutEmail)).toMatchObject(messageWithoutEmail)
    })

    it('should accept empty subject', () => {
      const messageWithEmptySubject = {
        subject: '',
        message: 'This is a message',
        email: 'customer@example.com',
      }
      expect(MessageStartSchema.parse(messageWithEmptySubject)).toMatchObject(messageWithEmptySubject)
    })

    it('should reject empty message', () => {
      const invalidMessage = {
        subject: 'Question',
        message: '',
        email: 'customer@example.com',
      }
      expect(() => MessageStartSchema.parse(invalidMessage)).toThrow()
    })

    it('should reject message over 1000 characters', () => {
      const invalidMessage = {
        message: 'A'.repeat(1001),
      }
      expect(() => MessageStartSchema.parse(invalidMessage)).toThrow()
    })

    it('should reject subject over 120 characters', () => {
      const invalidMessage = {
        subject: 'A'.repeat(121),
        message: 'This is a message',
      }
      expect(() => MessageStartSchema.parse(invalidMessage)).toThrow()
    })

    it('should accept message at exactly 1000 characters', () => {
      const messageWithMaxLength = {
        message: 'A'.repeat(1000),
      }
      expect(MessageStartSchema.parse(messageWithMaxLength).message).toHaveLength(1000)
    })

    it('should accept subject at exactly 120 characters', () => {
      const messageWithMaxSubject = {
        subject: 'A'.repeat(120),
        message: 'This is a message',
      }
      expect(MessageStartSchema.parse(messageWithMaxSubject).subject).toHaveLength(120)
    })

    it('should reject invalid email format', () => {
      const invalidMessage = {
        message: 'This is a message',
        email: 'not-an-email',
      }
      expect(() => MessageStartSchema.parse(invalidMessage)).toThrow()
    })

    it('should reject missing message field', () => {
      const invalidMessage = {
        subject: 'Question',
        email: 'customer@example.com',
      }
      expect(() => MessageStartSchema.parse(invalidMessage)).toThrow()
    })
  })

  describe('AdminReplySchema', () => {
    it('should accept valid admin reply', () => {
      const validReply = {
        conversationId: 'conv-123',
        message: 'Thank you for your question. Your order will ship tomorrow.',
      }
      expect(AdminReplySchema.parse(validReply)).toMatchObject(validReply)
    })

    it('should reject empty conversationId', () => {
      const invalidReply = {
        conversationId: '',
        message: 'This is a reply',
      }
      expect(() => AdminReplySchema.parse(invalidReply)).toThrow()
    })

    it('should reject empty message', () => {
      const invalidReply = {
        conversationId: 'conv-123',
        message: '',
      }
      expect(() => AdminReplySchema.parse(invalidReply)).toThrow()
    })

    it('should reject message over 1000 characters', () => {
      const invalidReply = {
        conversationId: 'conv-123',
        message: 'A'.repeat(1001),
      }
      expect(() => AdminReplySchema.parse(invalidReply)).toThrow()
    })

    it('should accept message at exactly 1000 characters', () => {
      const replyWithMaxMessage = {
        conversationId: 'conv-123',
        message: 'A'.repeat(1000),
      }
      expect(AdminReplySchema.parse(replyWithMaxMessage).message).toHaveLength(1000)
    })

    it('should reject missing required fields', () => {
      expect(() => AdminReplySchema.parse({ conversationId: 'conv-123' })).toThrow()
      expect(() => AdminReplySchema.parse({ message: 'Reply' })).toThrow()
    })
  })

  describe('RefundRequestSchema', () => {
    it('should accept valid refund request with all fields', () => {
      const validRefund = {
        amount: 50.00,
        reason: 'requested_by_customer',
      }
      expect(RefundRequestSchema.parse(validRefund)).toMatchObject(validRefund)
    })

    it('should accept refund request without amount', () => {
      const refundWithoutAmount = {
        reason: 'duplicate',
      }
      expect(RefundRequestSchema.parse(refundWithoutAmount)).toMatchObject(refundWithoutAmount)
    })

    it('should accept refund request without reason', () => {
      const refundWithoutReason = {
        amount: 25.00,
      }
      expect(RefundRequestSchema.parse(refundWithoutReason)).toMatchObject(refundWithoutReason)
    })

    it('should accept refund request with no fields', () => {
      const emptyRefund = {}
      expect(RefundRequestSchema.parse(emptyRefund)).toMatchObject(emptyRefund)
    })

    it('should accept all valid reason types', () => {
      expect(RefundRequestSchema.parse({ reason: 'requested_by_customer' })).toMatchObject({ reason: 'requested_by_customer' })
      expect(RefundRequestSchema.parse({ reason: 'duplicate' })).toMatchObject({ reason: 'duplicate' })
      expect(RefundRequestSchema.parse({ reason: 'fraudulent' })).toMatchObject({ reason: 'fraudulent' })
    })

    it('should coerce amount to number', () => {
      const refundWithStringAmount = {
        amount: '50.00',
      }
      const result = RefundRequestSchema.parse(refundWithStringAmount)
      expect(result.amount).toBe(50)
      expect(typeof result.amount).toBe('number')
    })

    it('should reject zero amount', () => {
      const invalidRefund = {
        amount: 0,
      }
      expect(() => RefundRequestSchema.parse(invalidRefund)).toThrow()
    })

    it('should reject negative amount', () => {
      const invalidRefund = {
        amount: -10,
      }
      expect(() => RefundRequestSchema.parse(invalidRefund)).toThrow()
    })

    it('should reject invalid reason', () => {
      const invalidRefund = {
        reason: 'invalid_reason',
      }
      expect(() => RefundRequestSchema.parse(invalidRefund)).toThrow()
    })
  })
})
