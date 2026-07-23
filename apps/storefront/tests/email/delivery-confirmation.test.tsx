/**
 * Delivery Confirmation Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { DeliveryConfirmationEmail } from '@/emails/delivery-confirmation'
import { OrderItem } from '@/emails/components/OrderItemsTable'

describe('DeliveryConfirmationEmail', () => {
  const mockItems: OrderItem[] = [
    {
      quantity: 2,
      productName: 'Original Salsa',
      productSku: 'SAL-ORG-16OZ',
      totalPrice: '$19.98',
    },
    {
      quantity: 1,
      productName: 'Spicy Salsa',
      productSku: 'SAL-SPI-16OZ',
      totalPrice: '$9.99',
    },
  ]

  const baseProps = {
    orderNumber: 'ORD-12345',
    deliveryDate: 'February 20, 2024',
    items: mockItems,
    shippingAddress: '123 Main St, Austin, TX 78701',
  }

  describe('rendering with required props', () => {
    it('should render delivery confirmation email with all required fields', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Your Order Has Been Delivered!')
      expect(html).toContain('ORD-12345')
      expect(html).toContain('February 20, 2024')
      expect(html).toContain('123 Main St, Austin, TX 78701')
    })

    it('should render all delivered items', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Original Salsa')
      expect(html).toContain('SAL-ORG-16OZ')
      expect(html).toContain('Spicy Salsa')
      expect(html).toContain('SAL-SPI-16OZ')
    })

    it('should include preview text with order number', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Order #ORD-12345 has been delivered')
    })

    it('should include feedback request section', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('How Was Your Experience?')
      expect(html).toMatch(/feedback|review/i)
    })
  })

  describe('optional props', () => {
    it('should use default name when not provided', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Hi <!-- -->there<!-- -->,')
    })

    it('should use custom name when provided', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          name={'Sarah Johnson'}
        />
      )

      expect(html).toContain('Hi <!-- -->Sarah Johnson<!-- -->,')
    })

    it('should include feedback button when feedbackUrl is provided', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          feedbackUrl={'https://example.com/feedback/ORD-12345'}
        />
      )

      expect(html).toContain('Leave a Review')
      expect(html).toContain('https://example.com/feedback/ORD-12345')
    })

    it('should not include feedback button when feedbackUrl is not provided', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).not.toContain('Leave a Review')
    })

    it('should include order details button when orderDetailsUrl is provided', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          orderDetailsUrl={'https://example.com/orders/ORD-12345'}
        />
      )

      expect(html).toContain('View Order Details')
      expect(html).toContain('https://example.com/orders/ORD-12345')
    })

    it('should not include order details section when orderDetailsUrl is not provided', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).not.toContain('View Order Details')
    })

    it('should include unsubscribe URL when provided', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          unsubscribeUrl={'https://example.com/unsubscribe'}
        />
      )

      expect(html).toContain('https://example.com/unsubscribe')
    })

    it('should use default unsubscribe URL when not provided', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      // Should have a fallback unsubscribe link
      expect(html).toMatch(/unsubscribe/i)
    })
  })

  describe('feedback section', () => {
    it('should include encouraging feedback message', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('How Was Your Experience?')
      expect(html).toMatch(/love to hear/i)
    })

    it('should explain feedback importance', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toMatch(/helps us improve/i)
    })

    it('should include feedback subtext', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          feedbackUrl={'https://example.com/feedback'}
        />
      )

      expect(html).toMatch(/honest opinion/i)
    })
  })

  describe('edge cases', () => {
    it('should handle empty items array', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          items={[]}
        />
      )

      expect(html).toContain('Your Order Has Been Delivered!')
      expect(html).toContain('ORD-12345')
    })

    it('should handle single item', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          items={[mockItems[0]]}
        />
      )

      expect(html).toContain('Original Salsa')
      expect(html).not.toContain('Spicy Salsa')
    })

    it('should handle long order numbers', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          orderNumber={'ORD-LONG-NUMBER-12345678901234'}
        />
      )

      expect(html).toContain('ORD-LONG-NUMBER-12345678901234')
    })

    it('should handle long shipping addresses', async () => {
      const longAddress =
        '1234 Very Long Street Name, Apartment 567, Building C, Floor 3, Austin, TX 78701, United States of America'
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          shippingAddress={longAddress}
        />
      )

      expect(html).toContain(longAddress)
    })

    it('should handle special characters in customer name', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          name={"O'Brien & Müller-Schmidt"}
        />
      )

      expect(html).toContain("O&#x27;Brien &amp; Müller-Schmidt")
    })

    it('should handle different date formats', async () => {
      const dateFormats = [
        'February 20, 2024',
        '2024-02-20',
        'Feb 20',
        'Tuesday, February 20, 2024 at 2:30 PM',
      ]

      for (const deliveryDate of dateFormats) {
        const html = await render(
          <DeliveryConfirmationEmail
            {...baseProps}
            deliveryDate={deliveryDate}
          />
        )

        expect(html).toContain(deliveryDate)
      }
    })

    it('should handle many items', async () => {
      const manyItems: OrderItem[] = Array.from({ length: 20 }, (_, i) => ({
        quantity: i + 1,
        productName: `Product ${i + 1}`,
        productSku: `SKU-${i + 1}`,
        totalPrice: `$${(i + 1) * 9.99}`,
      }))

      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          items={manyItems}
        />
      )

      expect(html).toContain('Product 1')
      expect(html).toContain('Product 20')
    })

    it('should handle both optional URLs provided', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          feedbackUrl={'https://example.com/feedback'}
          orderDetailsUrl={'https://example.com/orders'}
        />
      )

      expect(html).toContain('Leave a Review')
      expect(html).toContain('View Order Details')
      expect(html).toContain('https://example.com/feedback')
      expect(html).toContain('https://example.com/orders')
    })
  })

  describe('content validation', () => {
    it('should include support contact information', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('mike@josemadridsalsa.com')
    })

    it('should include company branding', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should have proper email structure', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      // Should have basic HTML email structure
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include delivery information section', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Delivery Information')
      expect(html).toContain('Order Number:')
      expect(html).toContain('Delivery Date:')
      expect(html).toContain('Delivered To:')
    })

    it('should include items delivered section', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Items Delivered')
    })

    it('should include emoji in heading', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('🎉')
    })

    it('should include positive messaging', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Great news!')
      expect(html).toMatch(/enjoy/i)
    })
  })

  describe('URL handling', () => {
    it('should handle feedback URLs with query parameters', async () => {
      const html = await render(
        <DeliveryConfirmationEmail
          {...baseProps}
          feedbackUrl={'https://example.com/feedback?order=ORD-12345&source=email'}
        />
      )

      expect(html).toContain('order=ORD-12345')
      expect(html).toContain('source=email')
    })

    it('should handle order details URLs with different paths', async () => {
      const urls = [
        'https://example.com/account/orders/ORD-12345',
        'https://shop.example.com/order-history',
        'https://example.com/track/ORD-12345',
      ]

      for (const orderDetailsUrl of urls) {
        const html = await render(
          <DeliveryConfirmationEmail
            {...baseProps}
            orderDetailsUrl={orderDetailsUrl}
          />
        )

        expect(html).toContain(orderDetailsUrl)
      }
    })
  })

  describe('delivery details section', () => {
    it('should display order number with hash symbol', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('#ORD-12345')
    })

    it('should list all delivered items with quantities', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      for (const item of mockItems) {
        expect(html).toContain(item.productName)
        expect(html).toContain(item.productSku)
      }
    })

    it('should show delivery address', async () => {
      const html = await render(<DeliveryConfirmationEmail {...baseProps} />)

      expect(html).toContain('Delivered To:')
      expect(html).toContain(baseProps.shippingAddress)
    })
  })
})
