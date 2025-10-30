import { describe, it, expect } from 'vitest'
import { ProductCreateSchema, MessageStartSchema, UserCreateSchema } from '@/lib/validation'

describe('validation', () => {
  it('validates product create', () => {
    const parsed = ProductCreateSchema.safeParse({
      name: 'Test',
      slug: 'test',
      description: '',
      price: 10,
      compareAtPrice: null,
      sku: 'SKU-1',
      inventory: 5,
      heatLevel: 'MILD',
      categoryId: 'cat1',
      isActive: true,
      isFeatured: false,
      featuredImage: '',
      images: [],
      metaTitle: '',
      metaDescription: '',
      searchKeywords: [],
    })
    expect(parsed.success).toBe(true)
  })

  it('requires message', () => {
    const parsed = MessageStartSchema.safeParse({ subject: '' })
    expect(parsed.success).toBe(false)
  })

  it('requires strong password', () => {
    const parsed = UserCreateSchema.safeParse({ email: 'a@b.com', role: 'CUSTOMER', password: 'short' })
    expect(parsed.success).toBe(false)
  })
})
