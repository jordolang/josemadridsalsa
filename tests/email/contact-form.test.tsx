/**
 * Contact Form Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { ContactFormEmail } from '@/emails/contact-form'

describe('ContactFormEmail', () => {
  const baseProps = {
    name: 'John Smith',
    email: 'john.smith@example.com',
    message: 'I would like to inquire about wholesale pricing for your products.',
  }

  describe('rendering with required props', () => {
    it('should render contact form email with all required fields', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('New Contact Form Submission')
      expect(html).toContain('John Smith')
      expect(html).toContain('john.smith@example.com')
      expect(html).toContain('wholesale pricing')
    })

    it('should include preview text with sender name', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('New contact form submission from John Smith')
    })

    it('should include contact information section', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Contact Information')
      expect(html).toContain('Name:')
      expect(html).toContain('Email:')
    })

    it('should include message section', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Message')
      expect(html).toContain(baseProps.message)
    })

    it('should include reply button', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Reply to John Smith')
      expect(html).toContain('mailto:john.smith@example.com')
    })
  })

  describe('optional props', () => {
    it('should include phone number when provided', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          phone={'(512) 555-1234'}
        />
      )

      expect(html).toContain('Phone:')
      expect(html).toContain('(512) 555-1234')
    })

    it('should not include phone section when not provided', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).not.toContain('Phone:')
    })

    it('should include submission timestamp when provided', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          submittedAt={'February 17, 2024 at 2:30 PM'}
        />
      )

      expect(html).toContain('Submitted:')
      expect(html).toContain('February 17, 2024 at 2:30 PM')
    })

    it('should not include submitted section when not provided', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).not.toContain('Submitted:')
    })

    it('should include unsubscribe URL when provided', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          unsubscribeUrl={'https://example.com/unsubscribe'}
        />
      )

      expect(html).toContain('https://example.com/unsubscribe')
    })

    it('should use default unsubscribe URL when not provided', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      // Should have a fallback unsubscribe link
      expect(html).toMatch(/unsubscribe/i)
    })

    it('should handle all optional fields provided together', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          phone={'(512) 555-1234'}
          submittedAt={'February 17, 2024 at 2:30 PM'}
          unsubscribeUrl={'https://example.com/unsubscribe'}
        />
      )

      expect(html).toContain('(512) 555-1234')
      expect(html).toContain('February 17, 2024 at 2:30 PM')
      expect(html).toContain('https://example.com/unsubscribe')
    })
  })

  describe('email formatting', () => {
    it('should create clickable email link', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('mailto:john.smith@example.com')
    })

    it('should handle different email formats', async () => {
      const emails = [
        'simple@example.com',
        'first.last@example.com',
        'user+tag@example.co.uk',
        'name_123@sub.example.com',
      ]

      emails.forEach((email) => {
        const html = await render(
          ContactFormEmail({
            ...baseProps,
            email,
          })
        )

        expect(html).toContain(email)
        expect(html).toContain(`mailto:${email}`)
      })
    })
  })

  describe('message content handling', () => {
    it('should preserve line breaks in message', async () => {
      const multilineMessage = `Hello,

I have a few questions:
1. What are your wholesale prices?
2. Do you offer bulk discounts?
3. What is your minimum order?

Thanks!`

      const html = await render(
        <ContactFormEmail
          {...baseProps}
          message={multilineMessage}
        />
      )

      expect(html).toContain('Hello,')
      expect(html).toContain('wholesale prices')
      expect(html).toContain('bulk discounts')
      expect(html).toContain('Thanks!')
    })

    it('should handle short messages', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          message={'Hello!'}
        />
      )

      expect(html).toContain('Hello!')
    })

    it('should handle long messages', async () => {
      const longMessage = 'A'.repeat(1000)
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          message={longMessage}
        />
      )

      expect(html).toContain(longMessage)
    })

    it('should handle special characters in message', async () => {
      const specialMessage = `Email: test@example.com
Price: $50.00
Special: <special> & "quoted"
Symbols: © ® ™`

      const html = await render(
        <ContactFormEmail
          {...baseProps}
          message={specialMessage}
        />
      )

      expect(html).toContain('test@example.com')
      expect(html).toContain('$50.00')
    })

    it('should handle unicode characters in message', async () => {
      const unicodeMessage = 'Hola! ¿Cómo estás? 你好 🌶️'

      const html = await render(
        <ContactFormEmail
          {...baseProps}
          message={unicodeMessage}
        />
      )

      expect(html).toContain('Hola')
      expect(html).toContain('🌶️')
    })
  })

  describe('name handling', () => {
    it('should handle simple names', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('John Smith')
      expect(html).toContain('Reply to John Smith')
    })

    it('should handle names with special characters', async () => {
      const specialNames = [
        "O'Brien",
        'García-López',
        'van der Berg',
        'José María',
        'Jean-François',
      ]

      specialNames.forEach((name) => {
        const html = await render(
          ContactFormEmail({
            ...baseProps,
            name,
          })
        )

        expect(html).toMatch(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, '.*')))
        expect(html).toContain('Reply to')
      })
    })

    it('should handle long names', async () => {
      const longName = 'Christopher Alexander Montgomery-Fitzpatrick III'
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          name={longName}
        />
      )

      expect(html).toContain('Christopher Alexander')
    })

    it('should handle single-word names', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          name={'Madonna'}
        />
      )

      expect(html).toContain('Madonna')
      expect(html).toContain('Reply to Madonna')
    })
  })

  describe('phone number handling', () => {
    it('should handle different phone formats', async () => {
      const phoneFormats = [
        '(512) 555-1234',
        '512-555-1234',
        '+1 512 555 1234',
        '5125551234',
        '+1 (512) 555-1234 ext. 123',
      ]

      phoneFormats.forEach((phone) => {
        const html = await render(
          ContactFormEmail({
            ...baseProps,
            phone,
          })
        )

        expect(html).toContain(phone)
      })
    })

    it('should handle international phone numbers', async () => {
      const internationalPhones = [
        '+44 20 7946 0958',
        '+52 55 1234 5678',
        '+61 2 1234 5678',
      ]

      internationalPhones.forEach((phone) => {
        const html = await render(
          ContactFormEmail({
            ...baseProps,
            phone,
          })
        )

        expect(html).toContain(phone)
      })
    })
  })

  describe('content validation', () => {
    it('should include company branding', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should have proper email structure', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      // Should have basic HTML email structure
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include descriptive text', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('received a new message')
      expect(html).toContain('contact form')
    })

    it('should include call to action', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Reply to this message')
    })
  })

  describe('edge cases', () => {
    it('should handle empty message', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          message={''}
        />
      )

      expect(html).toContain('New Contact Form Submission')
      expect(html).toContain('John Smith')
    })

    it('should handle message with only whitespace', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          message={'   \n\n   '}
        />
      )

      expect(html).toContain('Message')
    })

    it('should handle very short names', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          name={'Jo'}
        />
      )

      expect(html).toContain('Jo')
    })

    it('should handle email addresses with plus signs', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          email={'user+newsletter@example.com'}
        />
      )

      expect(html).toContain('user+newsletter@example.com')
      expect(html).toContain('mailto:user+newsletter@example.com')
    })
  })

  describe('timestamp formatting', () => {
    it('should handle different timestamp formats', async () => {
      const timestamps = [
        'February 17, 2024',
        '2024-02-17',
        'Feb 17, 2024 at 2:30 PM',
        '17/02/2024 14:30',
        'Friday, February 17, 2024',
      ]

      timestamps.forEach((submittedAt) => {
        const html = await render(
          ContactFormEmail({
            ...baseProps,
            submittedAt,
          })
        )

        expect(html).toContain(submittedAt)
      })
    })
  })

  describe('mailto link generation', () => {
    it('should create correct mailto link in reply button', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('mailto:john.smith@example.com')
    })

    it('should create mailto link in contact information section', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      // Email should be clickable in the details section
      expect(html).toMatch(/mailto:john\.smith@example\.com/g)
    })

    it('should handle special characters in email for mailto', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          email={'user+test@example.com'}
        />
      )

      expect(html).toContain('mailto:user+test@example.com')
    })
  })
})
