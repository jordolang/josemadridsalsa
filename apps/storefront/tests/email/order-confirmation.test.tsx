/**
 * Order Confirmation Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'
import { OrderItem } from '@/emails/components/OrderItemsTable'
import { RecommendedProduct } from '@/emails/components/RecommendedProducts'

describe('OrderConfirmationEmail', () => {
  const mockItems: OrderItem[] = [
    {
      quantity: 2,
      productName: 'Original Salsa',
      productSku: 'SAL-ORG-16OZ',
      totalPrice: '19.98',
    },
    {
      quantity: 1,
      productName: 'Spicy Salsa',
      productSku: 'SAL-SPI-16OZ',
      totalPrice: '9.99',
    },
  ]

  const baseProps = {
    orderNumber: 'ORD-12345',
    orderDate: '2024-02-17',
    orderTotal: '$29.97',
    items: mockItems,
    shippingAddress: '123 Main St, Austin, TX 78701',
  }

  describe('rendering with required props', () => {
    it('should render order confirmation email with all required fields', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Order Confirmed!')
      expect(html).toContain('ORD-12345')
      expect(html).toContain('2024-02-17')
      expect(html).toContain('$29.97')
      expect(html).toContain('123 Main St, Austin, TX 78701')
    })

    it('should render all order items', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Original Salsa')
      expect(html).toContain('SAL-ORG-16OZ')
      expect(html).toContain('$19.98')
      expect(html).toContain('Spicy Salsa')
      expect(html).toContain('SAL-SPI-16OZ')
      expect(html).toContain('$9.99')
    })

    it('should include preview text with order number', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Order #ORD-12345 confirmed')
    })
  })

  describe('optional props', () => {
    it('should use default name when not provided', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Hi there,')
    })

    it('should use custom name when provided', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          name="John Smith"
        />
      )

      expect(html).toContain('Hi John Smith,')
    })

    it('should include tracking link when provided', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          trackingLink={'https://example.com/track/ORD-12345'}
        />
      )

      expect(html).toContain('Track Order')
      expect(html).toContain('https://example.com/track/ORD-12345')
    })

    it('should not include tracking section when trackingLink is not provided', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).not.toContain('Track Order')
    })

    it('should include unsubscribe URL when provided', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          unsubscribeUrl={'https://example.com/unsubscribe'}
        />
      )

      expect(html).toContain('https://example.com/unsubscribe')
    })

    it('should use default unsubscribe URL when not provided', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      // Should have a fallback unsubscribe link
      expect(html).toMatch(/unsubscribe/i)
    })
  })

  describe('edge cases', () => {
    it('should handle empty items array', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          items={[]}
        />
      )

      expect(html).toContain('Order Confirmed!')
      expect(html).toContain('ORD-12345')
    })

    it('should handle single item', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          items={[mockItems[0]]}
        />
      )

      expect(html).toContain('Original Salsa')
      expect(html).not.toContain('Spicy Salsa')
    })

    it('should handle long order numbers', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          orderNumber={'ORD-VERY-LONG-ORDER-NUMBER-12345678'}
        />
      )

      expect(html).toContain('ORD-VERY-LONG-ORDER-NUMBER-12345678')
    })

    it('should handle long shipping addresses', async () => {
      const longAddress =
        '1234 Very Long Street Name, Apartment 567, Building C, Austin, TX 78701, United States'
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          shippingAddress={longAddress}
        />
      )

      expect(html).toContain(longAddress)
    })

    it('should handle special characters in customer name', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          name={"O'Brien & Smith-Jones"}
        />
      )

      expect(html).toContain("O&#x27;Brien &amp; Smith-Jones")
    })

    it('should handle large order totals', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          orderTotal={'$1,234.56'}
        />
      )

      expect(html).toContain('$1,234.56')
    })

    it('should handle many items', async () => {
      const manyItems: OrderItem[] = Array.from({ length: 10 }, (_, i) => ({
        quantity: i + 1,
        productName: `Product ${i + 1}`,
        productSku: `SKU-${i + 1}`,
        totalPrice: ((i + 1) * 9.99).toFixed(2),
      }))

      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          items={manyItems}
        />
      )

      expect(html).toContain('Product 1')
      expect(html).toContain('Product 10')
      expect(html).toContain('SKU-10')
    })
  })

  describe('content validation', () => {
    it('should include support contact information', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('mike@josemadridsalsa.com')
    })

    it('should include company branding', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should have proper email structure', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      // Should have basic HTML email structure
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include order details section', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Order Details')
      expect(html).toContain('Order Number:')
      expect(html).toContain('Order Date:')
      expect(html).toContain('Shipping:')
    })

    it('should include order items section', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Order Items')
    })

    it('should include total section', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Total:')
    })
  })

  describe('data formatting', () => {
    it('should format order number with hash symbol in preview', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('Order #ORD-12345')
    })

    it('should display quantity correctly', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).toContain('2') // quantity from first item
    })

    it('should handle zero-priced items', async () => {
      const freeItem: OrderItem = {
        quantity: 1,
        productName: 'Free Sample',
        productSku: 'SAL-SAMPLE',
        totalPrice: '0.00',
      }

      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          items={[freeItem]}
        />
      )

      expect(html).toContain('Free Sample')
      expect(html).toContain('$0.00')
    })
  })

  describe('recommended products', () => {
    const mockRecommendedProducts: RecommendedProduct[] = [
      {
        name: 'Jalapeño Verde Salsa',
        slug: 'jalapeno-verde',
        price: 9.99,
        imageUrl: 'https://example.com/jalapeno-verde.jpg',
        heatLevel: 'Medium',
      },
      {
        name: 'Habanero Hot Salsa',
        slug: 'habanero-hot',
        price: 10.99,
        imageUrl: 'https://example.com/habanero-hot.jpg',
        heatLevel: 'Hot',
      },
    ]

    it('should render recommended products when provided', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          recommendedProducts={mockRecommendedProducts}
        />
      )

      expect(html).toContain('You Might Also Like')
      expect(html).toContain('Jalapeño Verde Salsa')
      expect(html).toContain('Habanero Hot Salsa')
    })

    it('should not render recommended products section when empty', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          recommendedProducts={[]}
        />
      )

      expect(html).not.toContain('You Might Also Like')
    })

    it('should not render recommended products section when undefined', async () => {
      const html = await render(<OrderConfirmationEmail {...baseProps} />)

      expect(html).not.toContain('You Might Also Like')
    })

    it('should include heat level badges in recommendations', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          recommendedProducts={mockRecommendedProducts}
        />
      )

      expect(html).toContain('Medium')
      expect(html).toContain('Hot')
      expect(html).toContain('text-transform:uppercase')
    })

    it('should include product prices in recommendations', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          recommendedProducts={mockRecommendedProducts}
        />
      )

      expect(html).toContain('9.99')
      expect(html).toContain('10.99')
    })

    it('should include shop now buttons for recommendations', async () => {
      const html = await render(
        <OrderConfirmationEmail
          {...baseProps}
          recommendedProducts={mockRecommendedProducts}
        />
      )

      expect(html).toContain('Shop Now')
      expect(html).toContain('/products/jalapeno-verde')
      expect(html).toContain('/products/habanero-hot')
    })
  })
})
