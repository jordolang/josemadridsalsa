/**
 * Unit Tests for Email Sending Logic
 * Tests the sendEmail function from lib/email/client.ts
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import React from 'react'

// Set environment variables before any imports
process.env.RESEND_API_KEY = 'test_resend_api_key_12345'
process.env.FROM_EMAIL = 'Jose Madrid Salsa <mike@josemadridsalsa.com>'
process.env.NEXT_PUBLIC_BASE_URL = 'https://josemadrid.net'

// Mock Resend client with proper constructor
// We need to create the mock send function inside the factory to avoid hoisting issues
vi.mock('resend', () => {
  const mockSendFn = vi.fn()

  return {
    Resend: class MockResend {
      emails = {
        send: mockSendFn,
      }
    },
  }
})

// Mock logger functions
vi.mock('@/lib/email/logger', () => ({
  logEmailSend: vi.fn().mockResolvedValue({ id: 'log-123' }),
  checkUnsubscribed: vi.fn().mockResolvedValue(false),
}))

// Mock React Email render
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html><body>Test Email</body></html>'),
}))

// Import after mocks and env setup
import { sendEmail, renderEmailTemplate } from '@/lib/email/client'
import { logEmailSend, checkUnsubscribed } from '@/lib/email/logger'
import { render } from '@react-email/render'
import { Resend } from 'resend'

// Get the mock send function from the mocked Resend class
const mockResendSend = vi.mocked(new Resend('test').emails.send)

// Test React component
const TestEmailTemplate = () => React.createElement('div', null, 'Test Email')

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(render).mockResolvedValue('<html><body>Test Email</body></html>')
    vi.mocked(checkUnsubscribed).mockResolvedValue(false)
    vi.mocked(logEmailSend).mockResolvedValue({ id: 'log-123' } as any)
    mockResendSend.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    })
  })

  describe('Success scenarios', () => {
    it('should send email successfully with all required parameters', async () => {
      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'order-confirmation',
        orderId: 'order-123',
        userId: 'user-456',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('email-123')
      expect(render).toHaveBeenCalled()
      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'Jose Madrid Salsa <mike@josemadridsalsa.com>',
        to: 'customer@example.com',
        subject: 'Test Email',
        html: '<html><body>Test Email</body></html>',
        replyTo: undefined,
        headers: {
          'List-Unsubscribe': '<https://josemadrid.net/unsubscribe?email=customer%40example.com>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
    })

    it('should send email with array of recipients', async () => {
      const result = await sendEmail({
        to: ['customer1@example.com', 'customer2@example.com'],
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'marketing',
      })

      expect(result.success).toBe(true)
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['customer1@example.com', 'customer2@example.com'],
        })
      )
    })

    it('should use custom from and replyTo addresses', async () => {
      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        from: 'Custom <custom@example.com>',
        replyTo: 'reply@example.com',
        type: 'contact-form',
      })

      expect(result.success).toBe(true)
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Custom <custom@example.com>',
          replyTo: 'reply@example.com',
        })
      )
    })

    it('should log email send with SENT status', async () => {
      await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'order-confirmation',
        orderId: 'order-123',
        userId: 'user-456',
      })

      expect(logEmailSend).toHaveBeenCalledWith({
        recipientEmail: 'customer@example.com',
        recipientName: undefined,
        userId: 'user-456',
        templateId: 'order-confirmation',
        subject: 'Test Email',
        status: 'SENT',
        metadata: { orderId: 'order-123', messageId: 'email-123' },
      })
    })

    it('should include List-Unsubscribe headers for compliance', async () => {
      await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'newsletter',
      })

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'List-Unsubscribe': expect.stringContaining('/unsubscribe?email='),
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })
      )
    })

    it('should return data from Resend API', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'msg-xyz', from: 'test@example.com' },
        error: null,
      })

      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'order-confirmation',
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 'msg-xyz', from: 'test@example.com' })
    })
  })

  describe('Transactional email behavior', () => {
    beforeEach(() => {
      vi.mocked(checkUnsubscribed).mockResolvedValue(true) // User is unsubscribed
    })

    it('should send order-confirmation email even if user is unsubscribed', async () => {
      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Order Confirmation',
        react: React.createElement(TestEmailTemplate),
        type: 'order-confirmation',
      })

      expect(result.success).toBe(true)
      expect(checkUnsubscribed).not.toHaveBeenCalled()
      expect(mockResendSend).toHaveBeenCalled()
    })

    it('should send shipping-notification email even if user is unsubscribed', async () => {
      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Shipping Update',
        react: React.createElement(TestEmailTemplate),
        type: 'shipping-notification',
      })

      expect(result.success).toBe(true)
      expect(checkUnsubscribed).not.toHaveBeenCalled()
      expect(mockResendSend).toHaveBeenCalled()
    })

    it('should send delivery-confirmation email even if user is unsubscribed', async () => {
      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Delivery Confirmation',
        react: React.createElement(TestEmailTemplate),
        type: 'delivery-confirmation',
      })

      expect(result.success).toBe(true)
      expect(checkUnsubscribed).not.toHaveBeenCalled()
      expect(mockResendSend).toHaveBeenCalled()
    })

    it('should NOT send marketing email if user is unsubscribed', async () => {
      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Marketing Email',
        react: React.createElement(TestEmailTemplate),
        type: 'newsletter',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('User unsubscribed')
      expect(checkUnsubscribed).toHaveBeenCalledWith({
        email: 'customer@example.com',
        category: 'newsletter',
      })
      expect(mockResendSend).not.toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle Resend send errors', async () => {
      mockResendSend.mockResolvedValue({
        data: null,
        error: { message: 'Invalid email address', name: 'ValidationError' },
      })

      const result = await sendEmail({
        to: 'invalid-email',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email address')
      expect(logEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Invalid email address',
        })
      )
    })

    it('should handle Resend API exceptions', async () => {
      mockResendSend.mockRejectedValue(new Error('Network timeout'))

      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network timeout')
      expect(logEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Network timeout',
        })
      )
    })

    it('should handle render errors', async () => {
      vi.mocked(render).mockRejectedValue(new Error('Template render failed'))

      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Template render failed')
    })

    it('should handle unknown errors gracefully', async () => {
      mockResendSend.mockRejectedValue('Unknown error string')

      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error string')
    })

    it('should continue even if logging fails on success', async () => {
      vi.mocked(logEmailSend).mockRejectedValue(new Error('Database connection failed'))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
      })

      // Email should still be sent successfully
      expect(result.success).toBe(true)
      expect(mockResendSend).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to log email send:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Unsubscribe checking', () => {
    beforeEach(() => {
      vi.mocked(checkUnsubscribed).mockResolvedValue(false)
    })

    it('should check unsubscribe status for non-transactional emails', async () => {
      await sendEmail({
        to: 'customer@example.com',
        subject: 'Newsletter',
        react: React.createElement(TestEmailTemplate),
        type: 'newsletter',
      })

      expect(checkUnsubscribed).toHaveBeenCalledWith({
        email: 'customer@example.com',
        category: 'newsletter',
      })
    })

    it('should not send if user is unsubscribed from category', async () => {
      vi.mocked(checkUnsubscribed).mockResolvedValue(true)

      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Promotions',
        react: React.createElement(TestEmailTemplate),
        type: 'promotions',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('User unsubscribed')
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('should handle unsubscribe check returning false for non-marketing emails', async () => {
      // checkUnsubscribed handles its own errors and returns false for non-marketing
      // emails when there's a DB error (fail-open for non-marketing)
      vi.mocked(checkUnsubscribed).mockResolvedValue(false)

      const result = await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'custom-type', // Not in marketing categories
      })

      // Should send successfully for non-marketing emails
      expect(result.success).toBe(true)
    })
  })

  describe('Email metadata', () => {
    it('should include orderId in metadata when provided', async () => {
      await sendEmail({
        to: 'customer@example.com',
        subject: 'Order Confirmation',
        react: React.createElement(TestEmailTemplate),
        type: 'order-confirmation',
        orderId: 'order-789',
      })

      expect(logEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { orderId: 'order-789', messageId: 'email-123' },
        })
      )
    })

    it('should record only the Resend message id when orderId is not provided', async () => {
      await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
      })

      expect(logEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { messageId: 'email-123' },
        })
      )
    })

    it('should include userId in log when provided', async () => {
      await sendEmail({
        to: 'customer@example.com',
        subject: 'Test Email',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
        userId: 'user-123',
      })

      expect(logEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
        })
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle array of recipients and use first one for unsubscribe check', async () => {
      const result = await sendEmail({
        to: ['customer1@example.com', 'customer2@example.com'],
        subject: 'Newsletter',
        react: React.createElement(TestEmailTemplate),
        type: 'newsletter',
      })

      expect(result.success).toBe(true)
      expect(checkUnsubscribed).toHaveBeenCalledWith({
        email: 'customer1@example.com',
        category: 'newsletter',
      })
    })

    it('should properly URL encode email in unsubscribe link', async () => {
      await sendEmail({
        to: 'test+special@example.com',
        subject: 'Test',
        react: React.createElement(TestEmailTemplate),
        type: 'test',
      })

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'List-Unsubscribe': '<https://josemadrid.net/unsubscribe?email=test%2Bspecial%40example.com>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })
      )
    })
  })
})

describe('renderEmailTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(render).mockResolvedValue('<html><body>Rendered Email</body></html>')
  })

  it('should render React email template to HTML', async () => {
    const template = React.createElement(TestEmailTemplate)
    const html = await renderEmailTemplate(template)

    expect(html).toBe('<html><body>Rendered Email</body></html>')
    expect(render).toHaveBeenCalledWith(template)
  })

  it('should handle render errors', async () => {
    vi.mocked(render).mockRejectedValue(new Error('Render failed'))

    await expect(renderEmailTemplate(React.createElement(TestEmailTemplate))).rejects.toThrow(
      'Render failed'
    )
  })
})
