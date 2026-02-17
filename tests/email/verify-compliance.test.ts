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

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({
        id: 'test-email-id',
        error: null
      })
    }
  }))
}))

describe('Email Compliance - List-Unsubscribe Headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include List-Unsubscribe header when sending order confirmation', async () => {
    const { Resend } = await import('resend')
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'test-id' },
      error: null,
    })

    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: mockSend },
    }) as any)

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
    const { Resend } = await import('resend')
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'test-id' },
      error: null,
    })

    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: mockSend },
    }) as any)

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
          'List-Unsubscribe': expect.stringContaining('/unsubscribe?email=test@example.com'),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }),
      })
    )
  })

  it('should include List-Unsubscribe header when sending delivery confirmation', async () => {
    const { Resend } = await import('resend')
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'test-id' },
      error: null,
    })

    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: mockSend },
    }) as any)

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
    const { Resend } = await import('resend')
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'test-id' },
      error: null,
    })

    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: mockSend },
    }) as any)

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
  it('should include unsubscribe link in order confirmation email footer', () => {
    const html = render(
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

  it('should include unsubscribe link in shipping notification email footer', () => {
    const html = render(
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

  it('should include unsubscribe link in delivery confirmation email footer', () => {
    const html = render(
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

  it('should include unsubscribe link in contact form email footer', () => {
    const html = render(
      ContactFormEmail({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
        unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
      })
    )

    expect(html).toContain('Unsubscribe')
    expect(html).toContain('/unsubscribe')
  })

  it('should use default unsubscribe link (#) when URL not provided', () => {
    const html = render(
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
    const { Resend } = await import('resend')
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'test-id' },
      error: null,
    })

    vi.mocked(Resend).mockImplementation(() => ({
      emails: { send: mockSend },
    }) as any)

    const template = OrderConfirmationEmail({
      orderNumber: '12345',
      orderDate: '2024-01-15',
      orderTotal: '$45.00',
      items: [],
      shippingAddress: '123 Main St',
      unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
    })

    const html = render(template)

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
