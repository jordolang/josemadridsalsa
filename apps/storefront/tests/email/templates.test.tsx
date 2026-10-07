/**
 * Email Templates Comprehensive Rendering Tests
 * José Madrid Salsa E-commerce Platform
 *
 * This test suite covers all 4 email templates to ensure they render correctly
 * with their required props and share common email structure patterns.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'
import { ShippingNotificationEmail } from '@/emails/shipping-notification'
import { DeliveryConfirmationEmail } from '@/emails/delivery-confirmation'
import { ContactFormEmail } from '@/emails/contact-form'
import { OrderItem } from '@/emails/components/OrderItemsTable'

describe('Email Templates - Comprehensive Rendering Tests', () => {
  // Shared test data
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

  describe('Order Confirmation Email', () => {
    const props = {
      name: 'John Doe',
      orderNumber: 'ORD-12345',
      orderDate: '2024-02-17',
      orderTotal: '$29.97',
      items: mockItems,
      shippingAddress: '123 Main St, Austin, TX 78701',
      trackingLink: 'https://example.com/track/ORD-12345',
      unsubscribeUrl: 'https://example.com/unsubscribe',
    }

    it('should render with all props', async () => {
      const html = await render(<OrderConfirmationEmail {...props} />)

      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(0)
    })

    it('should include required order information', async () => {
      const html = await render(<OrderConfirmationEmail {...props} />)

      expect(html).toContain('Order Confirmed!')
      expect(html).toContain('ORD-12345')
      expect(html).toContain('2024-02-17')
      expect(html).toContain('$29.97')
      expect(html).toContain('123 Main St, Austin, TX 78701')
    })

    it('should include preview text', async () => {
      const html = await render(<OrderConfirmationEmail {...props} />)

      expect(html).toContain('Order #ORD-12345 confirmed')
    })

    it('should render all order items', async () => {
      const html = await render(<OrderConfirmationEmail {...props} />)

      expect(html).toContain('Original Salsa')
      expect(html).toContain('SAL-ORG-16OZ')
      expect(html).toContain('Spicy Salsa')
      expect(html).toContain('SAL-SPI-16OZ')
    })

    it('should include tracking link when provided', async () => {
      const html = await render(<OrderConfirmationEmail {...props} />)

      expect(html).toContain('Track Order')
      expect(html).toContain('https://example.com/track/ORD-12345')
    })

    it('should work without optional props', async () => {
      const minimalProps = {
        orderNumber: 'ORD-12345',
        orderDate: '2024-02-17',
        orderTotal: '$29.97',
        items: mockItems,
        shippingAddress: '123 Main St, Austin, TX 78701',
      }

      const html = await render(<OrderConfirmationEmail {...minimalProps} />)

      expect(html).toContain('Order Confirmed!')
      expect(html).toContain('ORD-12345')
    })
  })

  describe('Shipping Notification Email', () => {
    const props = {
      name: 'Jane Smith',
      orderNumber: 'ORD-67890',
      trackingNumber: 'TRK-1234567890',
      trackingUrl: 'https://tracking.example.com/TRK-1234567890',
      carrier: 'USPS',
      estimatedDelivery: 'February 20, 2024',
      shippingAddress: '456 Oak Ave, Dallas, TX 75201',
      items: mockItems,
      unsubscribeUrl: 'https://example.com/unsubscribe',
    }

    it('should render with all props', async () => {
      const html = await render(<ShippingNotificationEmail {...props} />)

      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(0)
    })

    it('should include required shipping information', async () => {
      const html = await render(<ShippingNotificationEmail {...props} />)

      expect(html).toContain('Your Order Has Shipped!')
      expect(html).toContain('ORD-67890')
      expect(html).toContain('TRK-1234567890')
      expect(html).toContain('USPS')
      expect(html).toContain('February 20, 2024')
      expect(html).toContain('456 Oak Ave, Dallas, TX 75201')
    })

    it('should include preview text', async () => {
      const html = await render(<ShippingNotificationEmail {...props} />)

      expect(html).toContain('Order #ORD-67890 has shipped')
    })

    it('should include tracking button', async () => {
      const html = await render(<ShippingNotificationEmail {...props} />)

      expect(html).toContain('Track Your Shipment')
      expect(html).toContain('https://tracking.example.com/TRK-1234567890')
    })

    it('should render order items', async () => {
      const html = await render(<ShippingNotificationEmail {...props} />)

      expect(html).toContain('Original Salsa')
      expect(html).toContain('Spicy Salsa')
    })
  })

  describe('Delivery Confirmation Email', () => {
    const props = {
      name: 'Bob Johnson',
      orderNumber: 'ORD-11111',
      deliveryDate: 'February 21, 2024',
      items: mockItems,
      shippingAddress: '789 Pine St, Houston, TX 77001',
      feedbackUrl: 'https://example.com/feedback/ORD-11111',
      orderDetailsUrl: 'https://example.com/orders/ORD-11111',
      unsubscribeUrl: 'https://example.com/unsubscribe',
    }

    it('should render with all props', async () => {
      const html = await render(<DeliveryConfirmationEmail {...props} />)

      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(0)
    })

    it('should include required delivery information', async () => {
      const html = await render(<DeliveryConfirmationEmail {...props} />)

      expect(html).toContain('Your Order Has Been Delivered!')
      expect(html).toContain('ORD-11111')
      expect(html).toContain('February 21, 2024')
      expect(html).toContain('789 Pine St, Houston, TX 77001')
    })

    it('should include preview text', async () => {
      const html = await render(<DeliveryConfirmationEmail {...props} />)

      expect(html).toContain('Order #ORD-11111 has been delivered')
    })

    it('should render delivered items', async () => {
      const html = await render(<DeliveryConfirmationEmail {...props} />)

      expect(html).toContain('Items Delivered')
      expect(html).toContain('Original Salsa')
      expect(html).toContain('Spicy Salsa')
    })

    it('should include feedback section when URL provided', async () => {
      const html = await render(<DeliveryConfirmationEmail {...props} />)

      expect(html).toContain('How Was Your Experience?')
      expect(html).toContain('Leave a Review')
      expect(html).toContain('https://example.com/feedback/ORD-11111')
    })

    it('should include order details link when URL provided', async () => {
      const html = await render(<DeliveryConfirmationEmail {...props} />)

      expect(html).toContain('View Order Details')
      expect(html).toContain('https://example.com/orders/ORD-11111')
    })

    it('should work without optional props', async () => {
      const minimalProps = {
        orderNumber: 'ORD-11111',
        deliveryDate: 'February 21, 2024',
        items: mockItems,
        shippingAddress: '789 Pine St, Houston, TX 77001',
      }

      const html = await render(<DeliveryConfirmationEmail {...minimalProps} />)

      expect(html).toContain('Your Order Has Been Delivered!')
      expect(html).toContain('ORD-11111')
    })
  })

  describe('Contact Form Email', () => {
    const props = {
      name: 'Alice Williams',
      email: 'alice.williams@example.com',
      company: 'Center Stage Dance Studio',
      phone: '(512) 555-1234',
      message: 'I would like to inquire about wholesale pricing for your products.',
    }

    it('should render with all props', async () => {
      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(0)
    })

    it('should include required contact information', async () => {
      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toContain('Contact form submission')
      expect(html).toContain('Alice Williams')
      expect(html).toContain('alice.williams@example.com')
      expect(html).toContain('wholesale pricing')
    })

    it('should include preview text', async () => {
      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toContain('A user has submitted the contact form on Jose Madrid Salsa')
    })

    it('should include company name when provided', async () => {
      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toContain('Company name:')
      expect(html).toContain('Center Stage Dance Studio')
    })

    it('should include phone number when provided', async () => {
      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toContain('(512) 555-1234')
    })

    it('should link the sender address and offer the store link', async () => {
      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toContain('mailto:alice.williams@example.com')
      expect(html).toContain('Open store')
    })

    it('should work without optional props', async () => {
      const minimalProps = {
        name: 'Alice Williams',
        email: 'alice.williams@example.com',
        message: 'I would like to inquire about wholesale pricing.',
      }

      const html = await render(<ContactFormEmail {...minimalProps} />)

      expect(html).toContain('Contact form submission')
      expect(html).toContain('Alice Williams')
      expect(html).toContain('alice.williams@example.com')
    })
  })

  describe('Common Email Structure - All Templates', () => {
    const orderConfirmationProps = {
      orderNumber: 'ORD-TEST',
      orderDate: '2024-02-17',
      orderTotal: '$29.97',
      items: mockItems,
      shippingAddress: '123 Main St',
    }

    const shippingNotificationProps = {
      orderNumber: 'ORD-TEST',
      trackingNumber: 'TRK-TEST',
      trackingUrl: 'https://example.com/track',
      carrier: 'USPS',
      estimatedDelivery: 'Feb 20',
      shippingAddress: '123 Main St',
      items: mockItems,
    }

    const deliveryConfirmationProps = {
      orderNumber: 'ORD-TEST',
      deliveryDate: 'Feb 21',
      items: mockItems,
      shippingAddress: '123 Main St',
    }

    const contactFormProps = {
      name: 'Test User',
      email: 'test@example.com',
      message: 'Test message',
    }

    // `subscriberFacing` marks the templates that go to a customer and therefore must
    // carry an unsubscribe link. The contact form notification is an internal alert sent
    // only to the business inbox, so it has nothing to unsubscribe from.
    const templates = [
      { name: 'Order Confirmation', component: OrderConfirmationEmail, props: orderConfirmationProps, subscriberFacing: true },
      { name: 'Shipping Notification', component: ShippingNotificationEmail, props: shippingNotificationProps, subscriberFacing: true },
      { name: 'Delivery Confirmation', component: DeliveryConfirmationEmail, props: deliveryConfirmationProps, subscriberFacing: true },
      { name: 'Contact Form', component: ContactFormEmail, props: contactFormProps, subscriberFacing: false },
    ]

    templates.forEach(({ name, component: Component, props, subscriberFacing }) => {
      describe(`${name} - Common Structure`, () => {
        it('should have proper HTML email structure', async () => {
          const html = await render(<Component {...props} />)

          expect(html).toContain('<!DOCTYPE')
          expect(html).toContain('<html')
          expect(html).toContain('</html>')
          expect(html).toContain('<body')
          expect(html).toContain('</body>')
        })

        it('should include company branding', async () => {
          const html = await render(<Component {...props} />)

          expect(html).toContain('Jose Madrid Salsa')
        })

        it('should include support email', async () => {
          const html = await render(<Component {...props} />)

          expect(html).toContain('josemadridsalsa.com')
        })

        it.runIf(subscriberFacing)('should include unsubscribe functionality', async () => {
          const html = await render(<Component {...props} />)

          expect(html).toMatch(/unsubscribe/i)
        })

        it('should render without errors', async () => {
          expect(async () => {
            await render(<Component {...props} />)
          }).not.toThrow()
        })

        it('should produce non-empty HTML output', async () => {
          const html = await render(<Component {...props} />)

          expect(html).toBeTruthy()
          expect(html.length).toBeGreaterThan(100)
        })
      })
    })
  })

  describe('Template Rendering Performance', () => {
    const orderConfirmationProps = {
      orderNumber: 'ORD-TEST',
      orderDate: '2024-02-17',
      orderTotal: '$29.97',
      items: mockItems,
      shippingAddress: '123 Main St',
    }

    const shippingNotificationProps = {
      orderNumber: 'ORD-TEST',
      trackingNumber: 'TRK-TEST',
      trackingUrl: 'https://example.com/track',
      carrier: 'USPS',
      estimatedDelivery: 'Feb 20',
      shippingAddress: '123 Main St',
      items: mockItems,
    }

    const deliveryConfirmationProps = {
      orderNumber: 'ORD-TEST',
      deliveryDate: 'Feb 21',
      items: mockItems,
      shippingAddress: '123 Main St',
    }

    const contactFormProps = {
      name: 'Test User',
      email: 'test@example.com',
      message: 'Test message',
    }

    it('should render Order Confirmation quickly', async () => {
      const start = Date.now()
      await render(<OrderConfirmationEmail {...orderConfirmationProps} />)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000) // Should render in under 1 second
    })

    it('should render Shipping Notification quickly', async () => {
      const start = Date.now()
      await render(<ShippingNotificationEmail {...shippingNotificationProps} />)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000)
    })

    it('should render Delivery Confirmation quickly', async () => {
      const start = Date.now()
      await render(<DeliveryConfirmationEmail {...deliveryConfirmationProps} />)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000)
    })

    it('should render Contact Form quickly', async () => {
      const start = Date.now()
      await render(<ContactFormEmail {...contactFormProps} />)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Template Edge Cases - All Templates', () => {
    it('should handle Order Confirmation with empty items array', async () => {
      const props = {
        orderNumber: 'ORD-TEST',
        orderDate: '2024-02-17',
        orderTotal: '$0.00',
        items: [],
        shippingAddress: '123 Main St',
      }

      const html = await render(<OrderConfirmationEmail {...props} />)

      expect(html).toContain('Order Confirmed!')
      expect(html).toContain('ORD-TEST')
    })

    it('should handle Shipping Notification with long tracking number', async () => {
      const props = {
        orderNumber: 'ORD-TEST',
        trackingNumber: 'VERY-LONG-TRACKING-NUMBER-1234567890-ABCDEFGH',
        trackingUrl: 'https://example.com/track',
        carrier: 'USPS',
        estimatedDelivery: 'Feb 20',
        shippingAddress: '123 Main St',
        items: mockItems,
      }

      const html = await render(<ShippingNotificationEmail {...props} />)

      expect(html).toContain('VERY-LONG-TRACKING-NUMBER-1234567890-ABCDEFGH')
    })

    it('should handle Delivery Confirmation with long address', async () => {
      const longAddress = '1234 Very Long Street Name, Apartment 567, Building C, Austin, TX 78701, United States'
      const props = {
        orderNumber: 'ORD-TEST',
        deliveryDate: 'Feb 21',
        items: mockItems,
        shippingAddress: longAddress,
      }

      const html = await render(<DeliveryConfirmationEmail {...props} />)

      expect(html).toContain(longAddress)
    })

    it('should handle Contact Form with special characters in name', async () => {
      const props = {
        name: "O'Brien & Smith-Jones",
        email: 'test@example.com',
        message: 'Test message',
      }

      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toContain("O&#x27;Brien &amp; Smith-Jones")
    })

    it('should handle Contact Form with very long message', async () => {
      const longMessage = 'A'.repeat(2000)
      const props = {
        name: 'Test User',
        email: 'test@example.com',
        message: longMessage,
      }

      const html = await render(<ContactFormEmail {...props} />)

      expect(html).toContain(longMessage)
    })

    it('should handle Order Confirmation with many items', async () => {
      const manyItems: OrderItem[] = Array.from({ length: 20 }, (_, i) => ({
        quantity: i + 1,
        productName: `Product ${i + 1}`,
        productSku: `SKU-${i + 1}`,
        totalPrice: ((i + 1) * 9.99).toFixed(2),
      }))

      const props = {
        orderNumber: 'ORD-TEST',
        orderDate: '2024-02-17',
        orderTotal: '$1999.80',
        items: manyItems,
        shippingAddress: '123 Main St',
      }

      const html = await render(<OrderConfirmationEmail {...props} />)

      expect(html).toContain('Product 1')
      expect(html).toContain('Product 20')
    })
  })
})
