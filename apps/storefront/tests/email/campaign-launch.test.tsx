/**
 * Campaign Launch Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { CampaignLaunchEmail } from '@/lib/email/templates/campaign-launch'

describe('campaign launch email', () => {
  const baseProps = {
    coordinatorName: 'Sarah Johnson',
    campaignName: 'Spring Fundraiser 2024',
    organizationName: 'Lincoln Elementary School',
    campaignUrl: 'https://www.josemadridsalsa.com/fundraisers/spring-2024',
    startDate: 'March 1, 2024',
    endDate: 'March 15, 2024',
    unsubscribeUrl: 'https://www.josemadridsalsa.com/account/preferences',
  }

  describe('rendering with required props', () => {
    it('should render campaign launch email with campaign details', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Spring Fundraiser 2024')
      expect(html).toContain('Sarah Johnson')
      expect(html).toContain('Lincoln Elementary School')
      expect(html).toContain('March 1, 2024')
      expect(html).toContain('March 15, 2024')
    })

    it('should include preview text with campaign name', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Your Spring Fundraiser 2024 fundraiser is ready to launch!')
    })

    it('should include campaign dashboard link', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('View Campaign Dashboard')
      expect(html).toContain(baseProps.campaignUrl)
    })

    it('should include coordinator greeting', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Hi Sarah Johnson,')
    })

    it('should include campaign details section', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Campaign Details:')
      expect(html).toContain('Campaign: Spring Fundraiser 2024')
      expect(html).toContain('Duration: March 1, 2024 - March 15, 2024')
    })
  })

  describe('optional props', () => {
    it('should include goal amount when provided', async () => {
      const html = await render(
        <CampaignLaunchEmail
          {...baseProps}
          goalAmount={'$5,000'}
        />
      )

      expect(html).toContain('Goal: $5,000')
    })

    it('should not include goal section when not provided', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).not.toContain('Goal:')
    })

    it('should use custom support email when provided', async () => {
      const customEmail = 'support@example.com'
      const html = await render(
        <CampaignLaunchEmail
          {...baseProps}
          supportEmail={customEmail}
        />
      )

      expect(html).toContain(customEmail)
    })

    it('should use default support email when not provided', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('mike@josemadridsalsa.com')
    })

    it('should include unsubscribe URL', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain(baseProps.unsubscribeUrl)
    })
  })

  describe('content sections', () => {
    it('should include welcome message', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Great news!')
      expect(html).toContain('is now live and ready to share')
    })

    it('should include instructions for next steps', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Access your campaign dashboard')
      expect(html).toContain('add participants')
      expect(html).toContain('track progress')
    })

    it('should include support information', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Need help getting started?')
      expect(html).toContain('fundraising team')
    })

    it('should include contact information', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Questions?')
      expect(html).toContain('Contact us at')
    })
  })

  describe('campaign name variations', () => {
    it('should handle short campaign names', async () => {
      const html = await render(
        <CampaignLaunchEmail
          {...baseProps}
          campaignName={'Spring 2024'}
        />
      )

      expect(html).toContain('Spring 2024')
    })

    it('should handle long campaign names', async () => {
      const longName = 'Lincoln Elementary School Annual Spring Fundraiser for New Playground Equipment 2024'
      const html = await render(
        <CampaignLaunchEmail
          {...baseProps}
          campaignName={longName}
        />
      )

      expect(html).toContain(longName)
    })

    it('should handle campaign names with special characters', async () => {
      const specialName = "Teacher's Appreciation 2024 - Spring Edition"
      const html = await render(
        <CampaignLaunchEmail
          {...baseProps}
          campaignName={specialName}
        />
      )

      expect(html).toContain('Teacher')
      expect(html).toContain('Appreciation')
    })
  })

  describe('organization name variations', () => {
    it('should handle different organization names', async () => {
      const organizations = [
        { name: 'Lincoln Elementary School', searchText: 'Lincoln Elementary School' },
        { name: 'St. Mary\'s Church', searchText: 'St. Mary' },
        { name: 'Columbus Youth Soccer League', searchText: 'Columbus Youth Soccer League' },
        { name: 'First Baptist Church of Newark', searchText: 'First Baptist Church of Newark' },
      ]

      for (const { name, searchText } of organizations) {
        const html = await render(
          React.createElement(CampaignLaunchEmail, {
            ...baseProps,
            organizationName: name,
          })
        )

        expect(html).toContain(searchText)
      }
    })
  })

  describe('date formatting', () => {
    it('should handle different date formats', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('March 1, 2024')
      expect(html).toContain('March 15, 2024')
    })

    it('should handle short date ranges', async () => {
      const html = await render(
        <CampaignLaunchEmail
          {...baseProps}
          startDate={'March 1'}
          endDate={'March 3'}
        />
      )

      expect(html).toContain('March 1')
      expect(html).toContain('March 3')
    })

    it('should handle cross-month date ranges', async () => {
      const html = await render(
        <CampaignLaunchEmail
          {...baseProps}
          startDate={'March 28, 2024'}
          endDate={'April 10, 2024'}
        />
      )

      expect(html).toContain('March 28, 2024')
      expect(html).toContain('April 10, 2024')
    })
  })

  describe('goal amount formatting', () => {
    it('should handle different goal amount formats', async () => {
      const goals = ['$5,000', '$10,000.00', '$2,500', '$100,000']

      for (const goalAmount of goals) {
        const html = await render(
          React.createElement(CampaignLaunchEmail, {
            ...baseProps,
            goalAmount,
          })
        )

        expect(html).toContain(`Goal: ${goalAmount}`)
      }
    })
  })

  describe('email structure', () => {
    it('should have proper HTML email structure', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include branding', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should include call to action button', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain('View Campaign Dashboard')
      expect(html).toContain('href')
    })
  })

  describe('coordinator name variations', () => {
    it('should handle different name formats', async () => {
      const names = [
        'Sarah Johnson',
        'Dr. Maria García',
        'Rev. John Smith',
        'Ms. O\'Brien',
      ]

      for (const coordinatorName of names) {
        const html = await render(
          React.createElement(CampaignLaunchEmail, {
            ...baseProps,
            coordinatorName,
          })
        )

        expect(html).toMatch(/Hi .+,/)
      }
    })
  })

  describe('URL handling', () => {
    it('should include campaign URL in button', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain(baseProps.campaignUrl)
    })

    it('should handle different URL formats', async () => {
      const urls = [
        'https://www.josemadridsalsa.com/fundraisers/abc123',
        'https://josemadridsalsa.com/f/spring-2024',
        'https://www.josemadridsalsa.com/campaigns/lincoln-elementary',
      ]

      for (const campaignUrl of urls) {
        const html = await render(
          React.createElement(CampaignLaunchEmail, {
            ...baseProps,
            campaignUrl,
          })
        )

        expect(html).toContain(campaignUrl)
      }
    })

    it('should include unsubscribe URL', async () => {
      const html = await render(<CampaignLaunchEmail {...baseProps} />)

      expect(html).toContain(baseProps.unsubscribeUrl)
    })
  })
})
