/**
 * RecommendedProducts Email Component Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { RecommendedProducts, RecommendedProduct } from '@/emails/components/RecommendedProducts'

describe('RecommendedProducts', () => {
  const mockProducts: RecommendedProduct[] = [
    {
      name: 'Original Salsa',
      slug: 'original-salsa',
      price: 9.99,
      imageUrl: 'https://example.com/original.jpg',
      heatLevel: 'Mild',
    },
    {
      name: 'Spicy Salsa',
      slug: 'spicy-salsa',
      price: 10.99,
      imageUrl: 'https://example.com/spicy.jpg',
      heatLevel: 'Hot',
    },
    {
      name: 'Very Spicy Salsa',
      slug: 'very-spicy-salsa',
      price: 11.99,
      imageUrl: 'https://example.com/very-spicy.jpg',
      heatLevel: 'Very Hot',
    },
  ]

  describe('rendering with products', () => {
    it('should render recommendations section with products', async () => {
      const html = await render(<RecommendedProducts products={mockProducts} />)

      expect(html).toContain('You Might Also Like')
      expect(html).toContain('Based on your order')
      expect(html).toContain('Original Salsa')
      expect(html).toContain('Spicy Salsa')
      expect(html).toContain('Very Spicy Salsa')
    })

    it('should render product images', async () => {
      const html = await render(<RecommendedProducts products={mockProducts} />)

      expect(html).toContain('https://example.com/original.jpg')
      expect(html).toContain('https://example.com/spicy.jpg')
    })

    it('should render product prices', async () => {
      const html = await render(<RecommendedProducts products={mockProducts} />)

      expect(html).toContain('9.99')
      expect(html).toContain('10.99')
      expect(html).toContain('11.99')
    })

    it('should render heat level badges', async () => {
      const html = await render(<RecommendedProducts products={mockProducts} />)

      expect(html).toContain('Mild')
      expect(html).toContain('Hot')
      expect(html).toContain('Very Hot')
    })

    it('should render Shop Now buttons with correct links', async () => {
      const html = await render(<RecommendedProducts products={mockProducts} />)

      expect(html).toContain('Shop Now')
      expect(html).toContain('/products/original-salsa')
      expect(html).toContain('/products/spicy-salsa')
      expect(html).toContain('/products/very-spicy-salsa')
    })

    it('should limit to 4 products max', async () => {
      const manyProducts: RecommendedProduct[] = [
        ...mockProducts,
        {
          name: 'Product 4',
          slug: 'product-4',
          price: 12.99,
          imageUrl: 'https://example.com/p4.jpg',
          heatLevel: 'Medium',
        },
        {
          name: 'Product 5',
          slug: 'product-5',
          price: 13.99,
          imageUrl: 'https://example.com/p5.jpg',
          heatLevel: 'Mild',
        },
      ]

      const html = await render(<RecommendedProducts products={manyProducts} />)

      expect(html).toContain('Product 4')
      expect(html).not.toContain('Product 5') // Should be cut off at 4
    })
  })

  describe('custom site URL', () => {
    it('should use custom site URL when provided', async () => {
      const html = await render(
        <RecommendedProducts
          products={mockProducts}
          siteUrl="https://custom.com"
        />
      )

      expect(html).toContain('https://custom.com/products/original-salsa')
    })

    it('should use default site URL when not provided', async () => {
      const html = await render(<RecommendedProducts products={mockProducts} />)

      expect(html).toContain('https://josemadridsalsa.com/products')
    })
  })

  describe('empty state', () => {
    it('should not render when products array is empty and showEmpty is false', async () => {
      const html = await render(
        <RecommendedProducts products={[]} showEmpty={false} />
      )

      expect(html).not.toContain('You Might Also Like')
      expect(html).not.toContain('Shop Now')
    })

    it('should render empty message when products array is empty and showEmpty is true', async () => {
      const html = await render(
        <RecommendedProducts products={[]} showEmpty={true} />
      )

      expect(html).toContain('No recommendations available')
    })

    it('should use custom empty message when provided', async () => {
      const html = await render(
        <RecommendedProducts
          products={[]}
          showEmpty={true}
          emptyMessage="Custom empty message"
        />
      )

      expect(html).toContain('Custom empty message')
    })
  })

  describe('data formatting', () => {
    it('should format prices with 2 decimal places', async () => {
      const products: RecommendedProduct[] = [
        {
          name: 'Test Product',
          slug: 'test',
          price: 5,
          imageUrl: 'https://example.com/test.jpg',
        },
      ]

      const html = await render(<RecommendedProducts products={products} />)

      expect(html).toContain('5.00')
    })

    it('should handle string prices', async () => {
      const products: RecommendedProduct[] = [
        {
          name: 'Test Product',
          slug: 'test',
          price: '7.50',
          imageUrl: 'https://example.com/test.jpg',
        },
      ]

      const html = await render(<RecommendedProducts products={products} />)

      expect(html).toContain('7.50')
    })

    it('should render products without heat level', async () => {
      const products: RecommendedProduct[] = [
        {
          name: 'Test Product',
          slug: 'test',
          price: 9.99,
          imageUrl: 'https://example.com/test.jpg',
        },
      ]

      const html = await render(<RecommendedProducts products={products} />)

      expect(html).toContain('Test Product')
      expect(html).toContain('9.99')
    })
  })
})
