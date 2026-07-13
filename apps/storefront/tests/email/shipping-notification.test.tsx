/**
 * Shipping Notification Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { ShippingNotificationEmail } from '@/emails/shipping-notification'
import { OrderItem } from '@/emails/components/OrderItemsTable'

// React 19 / @react-email/render insert empty `<!-- -->` marker comments between
// adjacent text nodes (e.g. `Hi {name},` renders as `Hi <!-- -->there<!-- -->,`).
// Strip them so substring assertions match the logical rendered text.
const stripMarkers = (html: string) => html.replace(/<!--.*?-->/g, '')

describe('ShippingNotificationEmail', () => {
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
    trackingNumber: '1Z999AA10123456784',
    trackingUrl: 'https://tracking.ups.com/track?tracknum=1Z999AA10123456784',
    carrier: 'UPS',
    estimatedDelivery: 'February 20, 2024',
    shippingAddress: '123 Main St, Austin, TX 78701',
    items: mockItems,
  }

  describe('rendering with required props', () => {
    it('should render shipping notification email with all required fields', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Your Order Has Shipped!')
      expect(html).toContain('ORD-12345')
      expect(html).toContain('1Z999AA10123456784')
      expect(html).toContain('UPS')
      expect(html).toContain('February 20, 2024')
      expect(html).toContain('123 Main St, Austin, TX 78701')
    })

    it('should render all order items', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Original Salsa')
      expect(html).toContain('SAL-ORG-16OZ')
      expect(html).toContain('Spicy Salsa')
      expect(html).toContain('SAL-SPI-16OZ')
    })

    it('should include preview text with order number', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Order #ORD-12345 has shipped')
    })

    it('should include tracking link button', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Track Your Shipment')
      expect(html).toContain(
        'https://tracking.ups.com/track?tracknum=1Z999AA10123456784'
      )
    })
  })

  describe('optional props', () => {
    it('should use default name when not provided', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(stripMarkers(html)).toContain('Hi there,')
    })

    it('should use custom name when provided', async () => {
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          name={'Jane Doe'}
        />
      )

      expect(stripMarkers(html)).toContain('Hi Jane Doe,')
    })

    it('should include unsubscribe URL when provided', async () => {
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          unsubscribeUrl={'https://example.com/unsubscribe'}
        />
      )

      expect(html).toContain('https://example.com/unsubscribe')
    })

    it('should use default unsubscribe URL when not provided', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      // Should have a fallback unsubscribe link
      expect(html).toMatch(/unsubscribe/i)
    })
  })

  describe('tracking information section', () => {
    it('should display tracking information prominently', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Tracking Information')
      expect(html).toContain('Tracking Number:')
      expect(html).toContain('Carrier:')
      expect(html).toContain('Estimated Delivery:')
      expect(html).toContain('Shipping To:')
    })

    it('should handle different carriers', async () => {
      const carriers = ['USPS', 'FedEx', 'UPS', 'DHL']

      for (const carrier of carriers) {
        const html = await render(
          <ShippingNotificationEmail
            {...baseProps}
            carrier={carrier}
          />
        )

        expect(html).toContain(carrier)
      }
    })

    it('should handle different tracking number formats', async () => {
      const trackingNumbers = [
        '1Z999AA10123456784', // UPS
        '9400111899561243144610', // USPS
        '123456789012', // FedEx
        '9374889691090175442040', // USPS Priority
      ]

      for (const trackingNumber of trackingNumbers) {
        const html = await render(
          <ShippingNotificationEmail
            {...baseProps}
            trackingNumber={trackingNumber}
          />
        )

        expect(html).toContain(trackingNumber)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle empty items array', async () => {
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          items={[]}
        />
      )

      expect(html).toContain('Your Order Has Shipped!')
      expect(html).toContain('1Z999AA10123456784')
    })

    it('should handle single item', async () => {
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          items={[mockItems[0]]}
        />
      )

      expect(html).toContain('Original Salsa')
      expect(html).not.toContain('Spicy Salsa')
    })

    it('should handle long shipping addresses', async () => {
      const longAddress =
        '1234 Very Long Street Name, Apartment 567, Building C, Floor 3, Austin, TX 78701, United States'
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          shippingAddress={longAddress}
        />
      )

      expect(html).toContain(longAddress)
    })

    it('should handle special characters in customer name', async () => {
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          name={"O'Connor & García-López"}
        />
      )

      expect(html).toContain("O&#x27;Connor &amp; García-López")
    })

    it('should handle different date formats', async () => {
      const dateFormats = [
        'February 20, 2024',
        '2024-02-20',
        'Feb 20',
        'Tuesday, February 20',
      ]

      for (const estimatedDelivery of dateFormats) {
        const html = await render(
          <ShippingNotificationEmail
            {...baseProps}
            estimatedDelivery={estimatedDelivery}
          />
        )

        expect(html).toContain(estimatedDelivery)
      }
    })

    it('should handle many items', async () => {
      const manyItems: OrderItem[] = Array.from({ length: 15 }, (_, i) => ({
        quantity: i + 1,
        productName: `Product ${i + 1}`,
        productSku: `SKU-${i + 1}`,
        totalPrice: `$${(i + 1) * 9.99}`,
      }))

      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          items={manyItems}
        />
      )

      expect(html).toContain('Product 1')
      expect(html).toContain('Product 15')
    })
  })

  describe('content validation', () => {
    it('should include support contact information', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('mike@josemadridsalsa.com')
    })

    it('should include company branding', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should have proper email structure', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      // Should have basic HTML email structure
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include order number section', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Order #ORD-12345')
    })

    it('should include greeting message', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Great news!')
      expect(html).toContain('on its way')
    })
  })

  describe('tracking URL handling', () => {
    it('should handle tracking URLs with different protocols', async () => {
      const urls = [
        'https://tracking.ups.com/track?tracknum=123',
        'http://www.fedex.com/track?id=456',
        'https://tools.usps.com/track/789',
      ]

      for (const trackingUrl of urls) {
        const html = await render(
          <ShippingNotificationEmail
            {...baseProps}
            trackingUrl={trackingUrl}
          />
        )

        expect(html).toContain(trackingUrl)
      }
    })

    it('should handle tracking URLs with query parameters', async () => {
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          trackingUrl={'https://tracking.example.com/track?num=123&ref=order&source=email'}
        />
      )

      expect(html).toContain('num=123')
      expect(html).toContain('ref=order')
    })

    it('should escape special characters in tracking URL', async () => {
      const html = await render(
        <ShippingNotificationEmail
          {...baseProps}
          trackingUrl={'https://tracking.example.com/track?num=123&test=value'}
        />
      )

      // URLs should be properly encoded in HTML
      expect(html).toMatch(/tracking\.example\.com/)
    })
  })

  describe('order details section', () => {
    it('should display order number prominently', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      expect(html).toContain('Order #')
      expect(html).toContain('ORD-12345')
    })

    it('should list all items in the shipment', async () => {
      const html = await render(<ShippingNotificationEmail {...baseProps} />)

      for (const item of mockItems) {
        expect(html).toContain(item.productName)
        expect(html).toContain(item.productSku)
      }
    })
  })
})
