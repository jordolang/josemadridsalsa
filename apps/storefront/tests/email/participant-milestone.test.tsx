/**
 * Participant Milestone Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { ParticipantMilestoneEmail } from '@/lib/email/templates/participant-milestone'

describe('milestone email', () => {
  const baseProps = {
    participantName: 'John Smith',
    fundraiserName: 'Lincoln Elementary Spring Fundraiser',
    milestone: 1,
    totalSales: 1,
    totalRaised: '$25.00',
    dashboardUrl: 'https://www.josemadridsalsa.com/fundraisers/spring-2024/dashboard',
    unsubscribeUrl: 'https://www.josemadridsalsa.com/account/preferences',
  }

  describe('milestone 1st sale', () => {
    it('should send email at 1st sale', async () => {
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          milestone={1}
          totalSales={1}
        />
      )

      expect(html).toContain('John Smith')
      expect(html).toContain('first sale')
      expect(html).toContain('Total Sales: 1')
    })

    it('should include congratulations message for first sale', async () => {
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          milestone={1}
          totalSales={1}
        />
      )

      expect(html).toContain('Congratulations')
      expect(html).toContain('Amazing start')
    })
  })

  describe('milestone 5th sale', () => {
    it('should send email at 5th sale', async () => {
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          milestone={5}
          totalSales={5}
          totalRaised="$125.00"
        />
      )

      expect(html).toContain('5 sales')
      expect(html).toContain('Total Sales: 5')
      expect(html).toContain('$125.00')
    })

    it('should include encouraging message for fifth sale', async () => {
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          milestone={5}
          totalSales={5}
        />
      )

      expect(html).toContain('on a roll')
    })
  })

  describe('milestone 10th sale', () => {
    it('should send email at 10th sale', async () => {
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          milestone={10}
          totalSales={10}
          totalRaised="$250.00"
        />
      )

      expect(html).toContain('10 sales')
      expect(html).toContain('Total Sales: 10')
      expect(html).toContain('$250.00')
    })

    it('should include celebratory message for tenth sale', async () => {
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          milestone={10}
          totalSales={10}
        />
      )

      expect(html).toContain('Incredible impact')
    })
  })

  describe('rendering with required props', () => {
    it('should render participant milestone email with participant details', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('John Smith')
      expect(html).toContain('Lincoln Elementary Spring Fundraiser')
      expect(html).toContain('$25.00')
    })

    it('should include preview text with milestone', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Congratulations')
      expect(html).toContain('reached 1 sales')
    })

    it('should include dashboard link', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('View Your Dashboard')
      expect(html).toContain(baseProps.dashboardUrl)
    })

    it('should include participant greeting', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Hi John Smith,')
    })

    it('should include impact section', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Your Impact:')
      expect(html).toContain('Total Sales:')
      expect(html).toContain('Total Raised:')
    })
  })

  describe('optional props', () => {
    it('should use custom support email when provided', async () => {
      const customEmail = 'support@example.com'
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          supportEmail={customEmail}
        />
      )

      expect(html).toContain(customEmail)
    })

    it('should use default support email when not provided', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('fundraising@josemadridsalsa.com')
    })

    it('should include unsubscribe URL', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain(baseProps.unsubscribeUrl)
    })
  })

  describe('content sections', () => {
    it('should include congratulations message', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Congratulations')
      expect(html).toContain('Milestone')
    })

    it('should include impact statistics', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Total Sales: 1')
      expect(html).toContain('Total Raised: $25.00')
    })

    it('should include thank you message', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Thank you for your dedication')
      expect(html).toContain('Every sale brings us closer to our goal')
    })

    it('should include contact information', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

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
          React.createElement(ParticipantMilestoneEmail, {
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
        <ParticipantMilestoneEmail
          {...baseProps}
          fundraiserName={'Spring 2024'}
        />
      )

      expect(html).toContain('Spring 2024')
    })

    it('should handle long fundraiser names', async () => {
      const longName = 'Lincoln Elementary School Annual Spring Fundraiser for New Playground Equipment 2024'
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          fundraiserName={longName}
        />
      )

      expect(html).toContain(longName)
    })

    it('should handle fundraiser names with special characters', async () => {
      const specialName = "Teacher's Appreciation 2024 - Spring Edition"
      const html = await render(
        <ParticipantMilestoneEmail
          {...baseProps}
          fundraiserName={specialName}
        />
      )

      expect(html).toContain('Teacher')
      expect(html).toContain('Appreciation')
    })
  })

  describe('email structure', () => {
    it('should have proper HTML email structure', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include branding', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should include call to action button', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('View Your Dashboard')
      expect(html).toContain('href')
    })
  })

  describe('URL handling', () => {
    it('should include dashboard URL in button', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain(baseProps.dashboardUrl)
    })

    it('should handle different URL formats', async () => {
      const urls = [
        'https://www.josemadridsalsa.com/fundraisers/abc123/dashboard',
        'https://josemadridsalsa.com/f/spring-2024/dashboard',
        'https://www.josemadridsalsa.com/fundraisers/lincoln-elementary/dashboard',
      ]

      for (const dashboardUrl of urls) {
        const html = await render(
          React.createElement(ParticipantMilestoneEmail, {
            ...baseProps,
            dashboardUrl,
          })
        )

        expect(html).toContain(dashboardUrl)
      }
    })

    it('should include unsubscribe URL', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain(baseProps.unsubscribeUrl)
    })
  })

  describe('encouragement content', () => {
    it('should include encouragement to keep sharing', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('Keep sharing')
      expect(html).toContain('referral code')
    })

    it('should remind about making an impact', async () => {
      const html = await render(<ParticipantMilestoneEmail {...baseProps} />)

      expect(html).toContain('impact')
    })
  })

  describe('total raised formatting', () => {
    it('should handle different monetary amounts', async () => {
      const amounts = [
        '$25.00',
        '$125.00',
        '$250.00',
        '$1,234.56',
      ]

      for (const totalRaised of amounts) {
        const html = await render(
          React.createElement(ParticipantMilestoneEmail, {
            ...baseProps,
            totalRaised,
          })
        )

        expect(html).toContain(totalRaised)
      }
    })
  })
})
