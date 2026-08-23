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

      expect(html).toContain('Contact form submission')
      expect(html).toContain('John Smith')
      expect(html).toContain('john.smith@example.com')
      expect(html).toContain('wholesale pricing')
    })

    it('should include preview text naming the store', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('A user has submitted the contact form on Jose Madrid Salsa')
    })

    it('should include the details section with its labels', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Details')
      expect(html).toContain('Full Name:')
      expect(html).toContain('Email Address:')
      expect(html).toContain('Comments / questions:')
    })

    it('should include the submitted message', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain(baseProps.message)
    })

    it('should include the open store call to action', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Open store')
    })

    it('should accept a custom store name', async () => {
      const html = await render(<ContactFormEmail {...baseProps} storeName={'Jose Madrid Fundraising'} />)

      expect(html).toContain('A user has submitted the contact form on Jose Madrid Fundraising')
    })
  })

  describe('optional props', () => {
    it('should include company name when provided', async () => {
      const html = await render(<ContactFormEmail {...baseProps} company={'Center Stage Dance Studio'} />)

      expect(html).toContain('Company name:')
      expect(html).toContain('Center Stage Dance Studio')
    })

    it('should not include company section when not provided', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).not.toContain('Company name:')
    })

    it('should include phone number when provided', async () => {
      const html = await render(<ContactFormEmail {...baseProps} phone={'(512) 555-1234'} />)

      expect(html).toContain('Phone number:')
      expect(html).toContain('(512) 555-1234')
    })

    it('should not include phone section when not provided', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).not.toContain('Phone number:')
    })

    it('should handle all optional fields provided together', async () => {
      const html = await render(
        <ContactFormEmail
          {...baseProps}
          company={'Center Stage Dance Studio'}
          phone={'(512) 555-1234'}
        />
      )

      expect(html).toContain('Center Stage Dance Studio')
      expect(html).toContain('(512) 555-1234')
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

      for (const email of emails) {
        const html = await render(ContactFormEmail({ ...baseProps, email }))

        expect(html).toContain(email)
        expect(html).toContain(`mailto:${email}`)
      }
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

      const html = await render(<ContactFormEmail {...baseProps} message={multilineMessage} />)

      expect(html).toContain('Hello,')
      expect(html).toContain('wholesale prices')
      expect(html).toContain('bulk discounts')
      expect(html).toContain('Thanks!')
      expect(html).toContain('pre-wrap')
    })

    it('should handle short messages', async () => {
      const html = await render(<ContactFormEmail {...baseProps} message={'Hello!'} />)

      expect(html).toContain('Hello!')
    })

    it('should handle long messages', async () => {
      const longMessage = 'A'.repeat(1000)
      const html = await render(<ContactFormEmail {...baseProps} message={longMessage} />)

      expect(html).toContain(longMessage)
    })

    it('should handle special characters in message', async () => {
      const specialMessage = `Email: test@example.com
Price: $50.00
Special: <special> & "quoted"
Symbols: © ® ™`

      const html = await render(<ContactFormEmail {...baseProps} message={specialMessage} />)

      expect(html).toContain('test@example.com')
      expect(html).toContain('$50.00')
    })

    it('should handle unicode characters in message', async () => {
      const unicodeMessage = 'Hola! ¿Cómo estás? 你好 🌶️'

      const html = await render(<ContactFormEmail {...baseProps} message={unicodeMessage} />)

      expect(html).toContain('Hola')
      expect(html).toContain('🌶️')
    })
  })

  describe('name handling', () => {
    it('should handle simple names', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('John Smith')
    })

    it('should handle names with special characters', async () => {
      const specialNames = ["O'Brien", 'García-López', 'van der Berg', 'José María', 'Jean-François']

      for (const name of specialNames) {
        const html = await render(ContactFormEmail({ ...baseProps, name }))

        expect(html).toMatch(
          new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, '.*'))
        )
      }
    })

    it('should handle long names', async () => {
      const longName = 'Christopher Alexander Montgomery-Fitzpatrick III'
      const html = await render(<ContactFormEmail {...baseProps} name={longName} />)

      expect(html).toContain('Christopher Alexander')
    })

    it('should handle single-word names', async () => {
      const html = await render(<ContactFormEmail {...baseProps} name={'Madonna'} />)

      expect(html).toContain('Madonna')
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

      for (const phone of phoneFormats) {
        const html = await render(ContactFormEmail({ ...baseProps, phone }))

        expect(html).toContain(phone)
      }
    })

    it('should handle international phone numbers', async () => {
      const internationalPhones = ['+44 20 7946 0958', '+52 55 1234 5678', '+61 2 1234 5678']

      for (const phone of internationalPhones) {
        const html = await render(ContactFormEmail({ ...baseProps, phone }))

        expect(html).toContain(phone)
      }
    })
  })

  describe('content validation', () => {
    it('should include company branding', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
      expect(html).toContain('jose-madrid-salsa-logo.png')
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

      expect(html).toContain('A user has submitted the contact form on')
    })
  })

  describe('edge cases', () => {
    it('should handle empty message', async () => {
      const html = await render(<ContactFormEmail {...baseProps} message={''} />)

      expect(html).toContain('Contact form submission')
      expect(html).toContain('John Smith')
    })

    it('should handle message with only whitespace', async () => {
      const html = await render(<ContactFormEmail {...baseProps} message={'   \n\n   '} />)

      expect(html).toContain('Comments / questions:')
    })

    it('should handle very short names', async () => {
      const html = await render(<ContactFormEmail {...baseProps} name={'Jo'} />)

      expect(html).toContain('Jo')
    })

    it('should handle email addresses with plus signs', async () => {
      const html = await render(<ContactFormEmail {...baseProps} email={'user+newsletter@example.com'} />)

      expect(html).toContain('user+newsletter@example.com')
      expect(html).toContain('mailto:user+newsletter@example.com')
    })
  })

  describe('mailto link generation', () => {
    it('should create a mailto link for the sender address', async () => {
      const html = await render(<ContactFormEmail {...baseProps} />)

      expect(html).toMatch(/mailto:john\.smith@example\.com/g)
    })

    it('should handle special characters in email for mailto', async () => {
      const html = await render(<ContactFormEmail {...baseProps} email={'user+test@example.com'} />)

      expect(html).toContain('mailto:user+test@example.com')
    })
  })
})
