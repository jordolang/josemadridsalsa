/**
 * Participant Welcome Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { ParticipantWelcomeEmail } from '@/lib/email/templates/participant-welcome'

describe('participant welcome email', () => {
  const baseProps = {
    participantName: 'John Smith',
    fundraiserName: 'Lincoln Elementary Spring Fundraiser',
    referralCode: 'FR-ABC1-2345',
    fundraiserUrl: 'https://www.josemadridsalsa.com/fundraisers/spring-2024',
    unsubscribeUrl: 'https://josemadrid.net/unsubscribe?email=fixture%40example.com',
  }

  describe('rendering with required props', () => {
    it('should render participant welcome email with participant details', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('John Smith')
      expect(html).toContain('Lincoln Elementary Spring Fundraiser')
      expect(html).toContain('FR-ABC1-2345')
    })

    it('should include preview text with fundraiser name', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Welcome to the Lincoln Elementary Spring Fundraiser fundraiser!')
    })

    it('should include fundraiser details link', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('View Fundraiser Details')
      expect(html).toContain(baseProps.fundraiserUrl)
    })

    it('should include participant greeting', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Hi John Smith,')
    })

    it('should include referral code section', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Your Referral Code:')
      expect(html).toContain('FR-ABC1-2345')
    })
  })

  describe('optional props', () => {
    it('should use custom support email when provided', async () => {
      const customEmail = 'support@example.com'
      const html = await render(
        <ParticipantWelcomeEmail
          {...baseProps}
          supportEmail={customEmail}
        />
      )

      expect(html).toContain(customEmail)
    })

    it('should use default support email when not provided', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('mike@josemadridsalsa.com')
    })

    it('should include unsubscribe URL', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain(baseProps.unsubscribeUrl)
    })
  })

  describe('content sections', () => {
    it('should include welcome message', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Welcome to')
      expect(html).toContain('Lincoln Elementary Spring Fundraiser')
    })

    it('should include instructions on how to participate', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('How It Works:')
      expect(html).toContain('Share your referral code with supporters')
    })

    it('should include referral code sharing instructions', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Share your unique referral code')
      expect(html).toContain('Every order placed using your code')
    })

    it('should include contact information', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Questions?')
      expect(html).toContain('Contact us at')
    })
  })

  describe('participant name variations', () => {
    it('should handle different name formats', async () => {
      const names = [
        'Sarah Johnson',
        'Dr. Maria García',
        'John O\'Brien',
        'Ms. Smith',
      ]

      for (const participantName of names) {
        const html = await render(
          React.createElement(ParticipantWelcomeEmail, {
            ...baseProps,
            participantName,
          })
        )

        expect(html).toMatch(/Hi .+,/)
      }
    })
  })

  describe('fundraiser name variations', () => {
    it('should handle short fundraiser names', async () => {
      const html = await render(
        <ParticipantWelcomeEmail
          {...baseProps}
          fundraiserName={'Spring 2024'}
        />
      )

      expect(html).toContain('Spring 2024')
    })

    it('should handle long fundraiser names', async () => {
      const longName = 'Lincoln Elementary School Annual Spring Fundraiser for New Playground Equipment 2024'
      const html = await render(
        <ParticipantWelcomeEmail
          {...baseProps}
          fundraiserName={longName}
        />
      )

      expect(html).toContain(longName)
    })

    it('should handle fundraiser names with special characters', async () => {
      const specialName = "Teacher's Appreciation 2024 - Spring Edition"
      const html = await render(
        <ParticipantWelcomeEmail
          {...baseProps}
          fundraiserName={specialName}
        />
      )

      expect(html).toContain('Teacher')
      expect(html).toContain('Appreciation')
    })
  })

  describe('referral code variations', () => {
    it('should handle different referral code formats', async () => {
      const codes = [
        'FR-ABC1-2345',
        'FR-XYZ9-8765',
        'FR-TEST-CODE',
        'FR-1234-ABCD',
      ]

      for (const referralCode of codes) {
        const html = await render(
          React.createElement(ParticipantWelcomeEmail, {
            ...baseProps,
            referralCode,
          })
        )

        expect(html).toContain(referralCode)
      }
    })
  })

  describe('email structure', () => {
    it('should have proper HTML email structure', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include branding', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should include call to action button', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('View Fundraiser Details')
      expect(html).toContain('href')
    })
  })

  describe('URL handling', () => {
    it('should include fundraiser URL in button', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain(baseProps.fundraiserUrl)
    })

    it('should handle different URL formats', async () => {
      const urls = [
        'https://www.josemadridsalsa.com/fundraisers/abc123',
        'https://josemadridsalsa.com/f/spring-2024',
        'https://www.josemadridsalsa.com/fundraisers/lincoln-elementary',
      ]

      for (const fundraiserUrl of urls) {
        const html = await render(
          React.createElement(ParticipantWelcomeEmail, {
            ...baseProps,
            fundraiserUrl,
          })
        )

        expect(html).toContain(fundraiserUrl)
      }
    })

    it('should include unsubscribe URL', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain(baseProps.unsubscribeUrl)
    })
  })

  describe('instructional content', () => {
    it('should include step-by-step instructions', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('1. Share your referral code with supporters')
      expect(html).toContain('2. They use your code when making a purchase')
      expect(html).toContain('3. Track your impact and help reach the fundraising goal')
    })

    it('should explain the referral code purpose', async () => {
      const html = await render(<ParticipantWelcomeEmail {...baseProps} />)

      expect(html).toContain('Every order placed using your code helps support the fundraiser')
    })
  })
})
