/**
 * Campaign Summary Email Template Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { CampaignSummaryEmail } from '@/lib/email/templates/campaign-summary'

describe('campaign summary email', () => {
  const baseProps = {
    coordinatorName: 'Sarah Johnson',
    campaignName: 'Spring Fundraiser 2024',
    organizationName: 'Lincoln Elementary School',
    totalOrders: 45,
    totalRevenue: '$4,500.00',
    commissionEarned: '$1,350.00',
    participantCount: 12,
    campaignUrl: 'https://www.josemadridsalsa.com/fundraisers/spring-2024/dashboard',
    unsubscribeUrl: 'https://www.josemadridsalsa.com/account/preferences',
  }

  describe('rendering with required props', () => {
    it('should render campaign summary email with campaign totals', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Spring Fundraiser 2024')
      expect(html).toContain('Sarah Johnson')
      expect(html).toContain('Lincoln Elementary School')
      expect(html).toContain('Total Orders: 45')
      expect(html).toContain('Total Revenue: $4,500.00')
      expect(html).toContain('Commission Earned: $1,350.00')
      expect(html).toContain('Active Participants: 12')
    })

    it('quotes sales in the preview, since that is what a goal measures here', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Spring Fundraiser 2024 Campaign Summary - $4,500.00 raised!')
    })

    it('should include campaign dashboard link', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('View Full Campaign Report')
      expect(html).toContain(baseProps.campaignUrl)
    })

    it('should include coordinator greeting', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Hi Sarah Johnson,')
    })

    it('should include campaign totals section', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Campaign Totals:')
      expect(html).toContain('Total Orders: 45')
      expect(html).toContain('Total Revenue: $4,500.00')
      expect(html).toContain('Commission Earned: $1,350.00')
      expect(html).toContain('Active Participants: 12')
    })
  })

  describe('optional props', () => {
    it('should include top participants when provided', async () => {
      const topParticipants = [
        { name: 'John Smith', sales: 15 },
        { name: 'Maria Garcia', sales: 10 },
        { name: 'David Lee', sales: 8 },
      ]

      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          topParticipants={topParticipants}
        />
      )

      expect(html).toContain('Top Participants:')
      expect(html).toContain('1. John Smith - 15 sales')
      expect(html).toContain('2. Maria Garcia - 10 sales')
      expect(html).toContain('3. David Lee - 8 sales')
    })

    it('should not include top participants section when empty', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).not.toContain('Top Participants:')
    })

    it('should use custom support email when provided', async () => {
      const customEmail = 'support@example.com'
      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          supportEmail={customEmail}
        />
      )

      expect(html).toContain(customEmail)
    })

    it('should use default support email when not provided', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('mike@josemadridsalsa.com')
    })

    it('should include unsubscribe URL', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain(baseProps.unsubscribeUrl)
    })
  })

  describe('content sections', () => {
    it('should include summary message', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toMatch(/Here.*s a summary of your/)
      expect(html).toContain('Great work!')
    })

    it('should include thank you message', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Thank you for your leadership')
    })

    it('should include dashboard access information', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Access your campaign dashboard')
      expect(html).toContain('detailed analytics')
    })

    it('should include contact information', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Questions?')
      expect(html).toContain('Contact us at')
    })
  })

  describe('campaign totals formatting', () => {
    it('should handle zero orders', async () => {
      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          totalOrders={0}
        />
      )

      expect(html).toContain('Total Orders: 0')
    })

    it('should handle large order counts', async () => {
      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          totalOrders={1000}
        />
      )

      expect(html).toContain('Total Orders: 1000')
    })

    it('should handle different revenue formats', async () => {
      const revenues = ['$10,000.00', '$500.00', '$25,750.50']

      for (const totalRevenue of revenues) {
        const html = await render(
          React.createElement(CampaignSummaryEmail, {
            ...baseProps,
            totalRevenue,
          })
        )

        expect(html).toContain(`Total Revenue: ${totalRevenue}`)
      }
    })

    it('reports the group share as commission, not as "raised"', async () => {
      // A goal on this site is measured in sales, so "raised" is the sales figure.
      // Labelling the commission that way named the wrong number.
      const amounts = ['$3,000.00', '$150.00', '$7,725.15']

      for (const commissionEarned of amounts) {
        const html = await render(
          React.createElement(CampaignSummaryEmail, {
            ...baseProps,
            commissionEarned,
          })
        )

        expect(html).toContain(`Commission Earned: ${commissionEarned}`)
        expect(html).not.toContain('Total Raised')
      }
    })

    it('should handle different participant counts', async () => {
      const counts = [1, 5, 25, 100]

      for (const participantCount of counts) {
        const html = await render(
          React.createElement(CampaignSummaryEmail, {
            ...baseProps,
            participantCount,
          })
        )

        expect(html).toContain(`Active Participants: ${participantCount}`)
      }
    })
  })

  describe('top participants ranking', () => {
    it('should rank participants correctly', async () => {
      const topParticipants = [
        { name: 'Alice', sales: 20 },
        { name: 'Bob', sales: 15 },
        { name: 'Charlie', sales: 10 },
      ]

      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          topParticipants={topParticipants}
        />
      )

      expect(html).toContain('1. Alice - 20 sales')
      expect(html).toContain('2. Bob - 15 sales')
      expect(html).toContain('3. Charlie - 10 sales')
    })

    it('should handle single top participant', async () => {
      const topParticipants = [{ name: 'Top Seller', sales: 50 }]

      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          topParticipants={topParticipants}
        />
      )

      expect(html).toContain('Top Participants:')
      expect(html).toContain('1. Top Seller - 50 sales')
    })

    it('should handle up to 5 top participants', async () => {
      const topParticipants = [
        { name: 'First', sales: 25 },
        { name: 'Second', sales: 20 },
        { name: 'Third', sales: 15 },
        { name: 'Fourth', sales: 10 },
        { name: 'Fifth', sales: 5 },
      ]

      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          topParticipants={topParticipants}
        />
      )

      expect(html).toContain('1. First - 25 sales')
      expect(html).toContain('2. Second - 20 sales')
      expect(html).toContain('3. Third - 15 sales')
      expect(html).toContain('4. Fourth - 10 sales')
      expect(html).toContain('5. Fifth - 5 sales')
    })

    it('should handle participant names with special characters', async () => {
      const topParticipants = [
        { name: "O'Brien", sales: 10 },
        { name: 'María García', sales: 8 },
      ]

      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          topParticipants={topParticipants}
        />
      )

      expect(html).toMatch(/O.*Brien/)
      expect(html).toContain('María García')
    })
  })

  describe('email structure', () => {
    it('should have proper HTML email structure', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
    })

    it('should include branding', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('Jose Madrid Salsa')
    })

    it('should include call to action button', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain('View Full Campaign Report')
      expect(html).toContain('href')
    })
  })

  describe('campaign name variations', () => {
    it('should handle short campaign names', async () => {
      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          campaignName={'Spring 2024'}
        />
      )

      expect(html).toContain('Spring 2024')
    })

    it('should handle long campaign names', async () => {
      const longName = 'Lincoln Elementary School Annual Spring Fundraiser for New Playground Equipment 2024'
      const html = await render(
        <CampaignSummaryEmail
          {...baseProps}
          campaignName={longName}
        />
      )

      expect(html).toContain(longName)
    })
  })

  describe('organization name variations', () => {
    it('should handle different organization names', async () => {
      const organizations = [
        'Lincoln Elementary School',
        "St. Mary's Church",
        'Columbus Youth Soccer League',
      ]

      for (const organizationName of organizations) {
        const html = await render(
          React.createElement(CampaignSummaryEmail, {
            ...baseProps,
            organizationName,
          })
        )

        expect(html).toMatch(/Here.*s a summary of your .+ fundraising campaign/)
      }
    })
  })

  describe('URL handling', () => {
    it('should include campaign URL in button', async () => {
      const html = await render(<CampaignSummaryEmail {...baseProps} />)

      expect(html).toContain(baseProps.campaignUrl)
    })

    it('should handle different URL formats', async () => {
      const urls = [
        'https://www.josemadridsalsa.com/fundraisers/abc123/dashboard',
        'https://josemadridsalsa.com/f/spring-2024/report',
        'https://www.josemadridsalsa.com/campaigns/lincoln/summary',
      ]

      for (const campaignUrl of urls) {
        const html = await render(
          React.createElement(CampaignSummaryEmail, {
            ...baseProps,
            campaignUrl,
          })
        )

        expect(html).toContain(campaignUrl)
      }
    })
  })
})
