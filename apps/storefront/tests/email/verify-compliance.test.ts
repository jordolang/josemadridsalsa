/**
 * Email Compliance Verification Tests
 * Verifies that all emails include List-Unsubscribe headers and unsubscribe links in footer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set environment variable before imports
process.env.RESEND_API_KEY = 'test_api_key'

import { sendEmail } from '@/lib/email/client'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'
import { ShippingNotificationEmail } from '@/emails/shipping-notification'
import { DeliveryConfirmationEmail } from '@/emails/delivery-confirmation'
import { ContactFormEmail } from '@/emails/contact-form'
import { render } from '@react-email/render'
import { Resend } from 'resend'

// Mock Resend
// The email client instantiates a single Resend client at import time, so all
// instances must share the same send mock for assertions to observe the call.
vi.mock('resend', () => {
  const send = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null })
  return {
    Resend: class MockResend {
      emails = { send }
    },
  }
})

// Mock logger to avoid DB hits
vi.mock('@/lib/email/logger', () => ({
  checkUnsubscribed: vi.fn().mockResolvedValue(false),
  logEmailSend: vi.fn().mockResolvedValue({ id: 'log-id' }),
}))

// Shared send mock used by the client's singleton Resend instance
const mockSend = vi.mocked(new Resend('test').emails.send)

describe('Email Compliance - List-Unsubscribe Headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({ data: { id: 'test-id' }, error: null } as any)
  })

  it('should include List-Unsubscribe header when sending order confirmation', async () => {
    const template = OrderConfirmationEmail({
      orderNumber: '12345',
      orderDate: '2024-01-15',
      orderTotal: '$45.00',
      items: [],
      shippingAddress: '123 Main St',
    })

    await sendEmail({
      to: 'test@example.com',
      subject: 'Order Confirmation',
      react: template,
      type: 'order-confirmation',
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('/unsubscribe?email='),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }),
      })
    )
  })

  it('should include List-Unsubscribe header when sending shipping notification', async () => {
    const template = ShippingNotificationEmail({
      orderNumber: '12345',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://track.example.com',
      carrier: 'USPS',
      estimatedDelivery: '2024-01-20',
      shippingAddress: '123 Main St',
      items: [],
    })

    await sendEmail({
      to: 'test@example.com',
      subject: 'Shipping Notification',
      react: template,
      type: 'shipping-notification',
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('/unsubscribe?email=test%40example.com'),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }),
      })
    )
  })

  it('should include List-Unsubscribe header when sending delivery confirmation', async () => {
    const template = DeliveryConfirmationEmail({
      orderNumber: '12345',
      deliveryDate: '2024-01-20',
      shippingAddress: '123 Main St',
      items: [],
    })

    await sendEmail({
      to: 'test@example.com',
      subject: 'Delivery Confirmation',
      react: template,
      type: 'delivery-confirmation',
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('/unsubscribe?email='),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }),
      })
    )
  })

  it('should include List-Unsubscribe header when sending contact form email', async () => {
    const template = ContactFormEmail({
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Test message',
    })

    await sendEmail({
      to: 'support@example.com',
      subject: 'Contact Form Submission',
      react: template,
      type: 'contact-form',
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('/unsubscribe?email='),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }),
      })
    )
  })
})

describe('Email Compliance - Unsubscribe Links in Footer', () => {
  it('should include unsubscribe link in order confirmation email footer', async () => {
    const html = await render(
      OrderConfirmationEmail({
        orderNumber: '12345',
        orderDate: '2024-01-15',
        orderTotal: '$45.00',
        items: [],
        shippingAddress: '123 Main St',
        unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
      })
    )

    expect(html).toContain('Unsubscribe')
    expect(html).toContain('/unsubscribe')
  })

  it('should include unsubscribe link in shipping notification email footer', async () => {
    const html = await render(
      ShippingNotificationEmail({
        orderNumber: '12345',
        trackingNumber: 'TRACK123',
        trackingUrl: 'https://track.example.com',
        carrier: 'USPS',
        estimatedDelivery: '2024-01-20',
        shippingAddress: '123 Main St',
        items: [],
        unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
      })
    )

    expect(html).toContain('Unsubscribe')
    expect(html).toContain('/unsubscribe')
  })

  it('should include unsubscribe link in delivery confirmation email footer', async () => {
    const html = await render(
      DeliveryConfirmationEmail({
        orderNumber: '12345',
        deliveryDate: '2024-01-20',
        shippingAddress: '123 Main St',
        items: [],
        unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
      })
    )

    expect(html).toContain('Unsubscribe')
    expect(html).toContain('/unsubscribe')
  })

  // The contact form notification is an internal alert delivered only to the business
  // inbox (both routes that send it hardcode mike@josemadridsalsa.com), so there is no
  // subscription behind it and no footer unsubscribe link. The List-Unsubscribe header
  // is still applied by the email client — see the header suite above.
  it('should not carry a footer unsubscribe link in the internal contact form email', async () => {
    const html = await render(
      ContactFormEmail({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      })
    )

    expect(html).not.toContain('Unsubscribe')
    expect(html).toContain('Contact form submission')
  })

  it('should use default unsubscribe link (#) when URL not provided', async () => {
    const html = await render(
      OrderConfirmationEmail({
        orderNumber: '12345',
        orderDate: '2024-01-15',
        orderTotal: '$45.00',
        items: [],
        shippingAddress: '123 Main St',
        // unsubscribeUrl not provided - should use default '#'
      })
    )

    expect(html).toContain('Unsubscribe')
  })
})

describe('Email Compliance - Full Integration', () => {
  it('should have both header and footer unsubscribe when sending email', async () => {
    const template = OrderConfirmationEmail({
      orderNumber: '12345',
      orderDate: '2024-01-15',
      orderTotal: '$45.00',
      items: [],
      shippingAddress: '123 Main St',
      unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
    })

    const html = await render(template)

    await sendEmail({
      to: 'test@example.com',
      subject: 'Order Confirmation',
      react: template,
      type: 'order-confirmation',
    })

    // Verify header
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('/unsubscribe?email='),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }),
      })
    )

    // Verify footer link
    expect(html).toContain('Unsubscribe')
    expect(html).toContain('/unsubscribe')
  })
})
