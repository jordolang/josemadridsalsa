import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as ContactPOST } from '@/app/api/send-email/contact/route'
import { POST as ShippingPOST } from '@/app/api/send-email/shipping/route'
import { POST as DeliveryPOST } from '@/app/api/send-email/delivery/route'

// Mock email client
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
}))

// Mock email templates
vi.mock('@/emails/contact-form', () => ({
  ContactFormEmail: vi.fn(() => null),
}))

vi.mock('@/emails/shipping-notification', () => ({
  ShippingNotificationEmail: vi.fn(() => null),
}))

vi.mock('@/emails/delivery-confirmation', () => ({
  DeliveryConfirmationEmail: vi.fn(() => null),
}))

// Import the mocked sendEmail
import { sendEmail as mockSendEmail } from '@/lib/email/client'

describe('Send Email API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/send-email/contact', () => {
    const validContactData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
      message: 'I have a question about your products.',
      submittedAt: '2026-02-17T10:00:00Z',
      userId: 'user-123',
      unsubscribeUrl: 'https://example.com/unsubscribe',
    }

    it('should validate required field: name', async () => {
      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', message: 'Test' }),
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: name')
    })

    it('should validate required field: email', async () => {
      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: JSON.stringify({ name: 'John Doe', message: 'Test' }),
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: email')
    })

    it('should validate required field: message', async () => {
      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: JSON.stringify({ name: 'John Doe', email: 'test@example.com' }),
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: message')
    })

    it('should send contact form email successfully', async () => {
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      })

      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: JSON.stringify(validContactData),
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.messageId).toBe('msg-123')
      expect(data.from).toBe('john@example.com')

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'info@josemadridsalsa.com',
          subject: 'New Contact Form Submission from John Doe',
          type: 'contact-form',
          userId: 'user-123',
          replyTo: 'john@example.com',
        })
      )
    })

    it('should use default submittedAt if not provided', async () => {
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      })

      const dataWithoutTimestamp = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      }

      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: JSON.stringify(dataWithoutTimestamp),
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle email sending failure', async () => {
      mockSendEmail.mockResolvedValue({
        success: false,
        error: 'SMTP connection failed',
      })

      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: JSON.stringify(validContactData),
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to send contact form email')
      expect(data.details).toBe('SMTP connection failed')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toContain('JSON')
    })

    it('should handle sendEmail throwing error', async () => {
      mockSendEmail.mockRejectedValue(new Error('Network error'))

      const request = new NextRequest('http://localhost/api/send-email/contact', {
        method: 'POST',
        body: JSON.stringify(validContactData),
      })

      const response = await ContactPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toBe('Network error')
    })
  })

  describe('POST /api/send-email/shipping', () => {
    const validShippingData = {
      email: 'customer@example.com',
      name: 'Jane Smith',
      orderNumber: 'JMS-20260217-1234',
      trackingNumber: '1Z999AA10123456784',
      trackingUrl: 'https://tracking.example.com/1Z999AA10123456784',
      carrier: 'UPS',
      estimatedDelivery: '2026-02-20',
      shippingAddress: '123 Main St, Portland, OR 97201',
      items: [
        {
          name: 'Habanero Salsa',
          quantity: 2,
          price: 8.99,
          image: 'https://example.com/salsa.jpg',
        },
      ],
      orderId: 'order-123',
      userId: 'user-456',
      unsubscribeUrl: 'https://example.com/unsubscribe',
    }

    it('should validate required field: email', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify({ orderNumber: 'JMS-123' }),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: email')
    })

    it('should validate required field: orderNumber', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: orderNumber')
    })

    it('should validate required field: trackingNumber', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', orderNumber: 'JMS-123' }),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: trackingNumber')
    })

    it('should validate required field: trackingUrl', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          orderNumber: 'JMS-123',
          trackingNumber: '123',
        }),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: trackingUrl')
    })

    it('should validate required field: carrier', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          orderNumber: 'JMS-123',
          trackingNumber: '123',
          trackingUrl: 'https://example.com',
        }),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: carrier')
    })

    it('should validate required field: estimatedDelivery', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          orderNumber: 'JMS-123',
          trackingNumber: '123',
          trackingUrl: 'https://example.com',
          carrier: 'UPS',
        }),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: estimatedDelivery')
    })

    it('should validate required field: shippingAddress', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          orderNumber: 'JMS-123',
          trackingNumber: '123',
          trackingUrl: 'https://example.com',
          carrier: 'UPS',
          estimatedDelivery: '2026-02-20',
        }),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: shippingAddress')
    })

    it('should send shipping notification email successfully', async () => {
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-456',
      })

      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingData),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.messageId).toBe('msg-456')
      expect(data.orderNumber).toBe('JMS-20260217-1234')

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Your Order #JMS-20260217-1234 Has Shipped!',
          type: 'shipping-notification',
          orderId: 'order-123',
          userId: 'user-456',
          replyTo: 'orders@josemadridsalsa.com',
        })
      )
    })

    it('should handle missing items array', async () => {
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-456',
      })

      const dataWithoutItems = { ...validShippingData }
      delete (dataWithoutItems as any).items

      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify(dataWithoutItems),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle email sending failure', async () => {
      mockSendEmail.mockResolvedValue({
        success: false,
        error: 'Invalid email address',
      })

      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingData),
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to send shipping notification email')
      expect(data.details).toBe('Invalid email address')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/send-email/shipping', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await ShippingPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toContain('JSON')
    })
  })

  describe('POST /api/send-email/delivery', () => {
    const validDeliveryData = {
      email: 'customer@example.com',
      name: 'Bob Johnson',
      orderNumber: 'JMS-20260217-5678',
      deliveryDate: '2026-02-19T14:30:00Z',
      shippingAddress: '456 Oak Ave, Seattle, WA 98101',
      items: [
        {
          name: 'Mild Salsa',
          quantity: 3,
          price: 7.99,
          image: 'https://example.com/mild-salsa.jpg',
        },
      ],
      feedbackUrl: 'https://example.com/feedback',
      orderDetailsUrl: 'https://example.com/order/5678',
      orderId: 'order-789',
      userId: 'user-012',
      unsubscribeUrl: 'https://example.com/unsubscribe',
    }

    it('should validate required field: email', async () => {
      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify({ orderNumber: 'JMS-123' }),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: email')
    })

    it('should validate required field: orderNumber', async () => {
      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: orderNumber')
    })

    it('should validate required field: deliveryDate', async () => {
      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', orderNumber: 'JMS-123' }),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: deliveryDate')
    })

    it('should validate required field: shippingAddress', async () => {
      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          orderNumber: 'JMS-123',
          deliveryDate: '2026-02-19',
        }),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: shippingAddress')
    })

    it('should send delivery confirmation email successfully', async () => {
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-789',
      })

      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify(validDeliveryData),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.messageId).toBe('msg-789')
      expect(data.orderNumber).toBe('JMS-20260217-5678')

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Your Order #JMS-20260217-5678 Has Been Delivered!',
          type: 'delivery-confirmation',
          orderId: 'order-789',
          userId: 'user-012',
          replyTo: 'orders@josemadridsalsa.com',
        })
      )
    })

    it('should handle missing optional fields', async () => {
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-789',
      })

      const minimalData = {
        email: 'customer@example.com',
        orderNumber: 'JMS-20260217-5678',
        deliveryDate: '2026-02-19T14:30:00Z',
        shippingAddress: '456 Oak Ave, Seattle, WA 98101',
      }

      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify(minimalData),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle email sending failure', async () => {
      mockSendEmail.mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
      })

      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify(validDeliveryData),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to send delivery confirmation email')
      expect(data.details).toBe('Rate limit exceeded')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toContain('JSON')
    })

    it('should handle sendEmail throwing error', async () => {
      mockSendEmail.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost/api/send-email/delivery', {
        method: 'POST',
        body: JSON.stringify(validDeliveryData),
      })

      const response = await DeliveryPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.details).toBe('Database connection failed')
    })
  })
})
