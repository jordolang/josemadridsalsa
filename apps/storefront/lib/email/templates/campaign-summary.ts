import React from 'react'
import { Text, Section } from '@react-email/components'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHeader } from '@/emails/components/EmailHeader'
import { EmailFooter } from '@/emails/components/EmailFooter'
import { Button } from '@/emails/components/Button'

interface CampaignSummaryEmailProps {
  coordinatorName: string
  campaignName: string
  organizationName: string
  totalOrders: number
  totalRevenue: string
  totalRaised: string
  participantCount: number
  topParticipants?: Array<{ name: string; sales: number }>
  campaignUrl: string
  supportEmail?: string
  unsubscribeUrl: string
}

export function CampaignSummaryEmail({
  coordinatorName,
  campaignName,
  organizationName,
  totalOrders,
  totalRevenue,
  totalRaised,
  participantCount,
  topParticipants = [],
  campaignUrl,
  supportEmail = 'mike@josemadridsalsa.com',
  unsubscribeUrl,
}: CampaignSummaryEmailProps) {
  const previewText = `${campaignName} Campaign Summary - ${totalRaised} raised!`

  return React.createElement(
    EmailLayout,
    { previewText },
    React.createElement(EmailHeader, null),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 24px',
            fontSize: '24px',
            fontWeight: '700',
            color: '#dc2626',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.3',
          },
        },
        `${campaignName} Campaign Summary`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Hi ${coordinatorName},`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Here's a summary of your ${organizationName} fundraising campaign. Great work!`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        'Campaign Totals:'
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 8px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Total Orders: ${totalOrders}`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 8px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Total Revenue: ${totalRevenue}`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 8px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Total Raised: ${totalRaised}`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Active Participants: ${participantCount}`
      ),
      topParticipants.length > 0
        ? React.createElement(
            Text,
            {
              style: {
                margin: '16px 0 8px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                fontFamily: 'Arial, sans-serif',
                lineHeight: '1.6',
              },
            },
            'Top Participants:'
          )
        : null,
      ...topParticipants.map((participant, index) =>
        React.createElement(
          Text,
          {
            key: index,
            style: {
              margin: '0 0 8px',
              fontSize: '16px',
              color: '#1f2937',
              fontFamily: 'Arial, sans-serif',
              lineHeight: '1.6',
            },
          },
          `${index + 1}. ${participant.name} - ${participant.sales} sales`
        )
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '16px 0',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        'Thank you for your leadership and commitment to this fundraising campaign!'
      )
    ),
    React.createElement(
      Section,
      { style: { padding: '24px 0', textAlign: 'center' as const } },
      React.createElement(
        Button,
        {
          href: campaignUrl,
          variant: 'primary',
          size: 'medium',
        },
        'View Full Campaign Report'
      )
    ),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        'Access your campaign dashboard for detailed analytics, participant management, and more.'
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Questions? Contact us at ${supportEmail}.`
      )
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )
}
