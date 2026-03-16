import React from 'react'
import { Text, Section } from '@react-email/components'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHeader } from '@/emails/components/EmailHeader'
import { EmailFooter } from '@/emails/components/EmailFooter'
import { Button } from '@/emails/components/Button'

interface CampaignLaunchEmailProps {
  coordinatorName: string
  campaignName: string
  organizationName: string
  campaignUrl: string
  startDate: string
  endDate: string
  goalAmount?: string
  supportEmail?: string
  unsubscribeUrl: string
}

export function CampaignLaunchEmail({
  coordinatorName,
  campaignName,
  organizationName,
  campaignUrl,
  startDate,
  endDate,
  goalAmount,
  supportEmail = 'fundraising@josemadridsalsa.com',
  unsubscribeUrl,
}: CampaignLaunchEmailProps) {
  const previewText = `Your ${campaignName} fundraiser is ready to launch!`

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
        `Your ${campaignName} fundraiser is ready!`
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
        `Great news! Your fundraising campaign for ${organizationName} is now live and ready to share with participants.`
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
        'Campaign Details:'
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
        `Campaign: ${campaignName}`
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
        `Duration: ${startDate} - ${endDate}`
      ),
      goalAmount
        ? React.createElement(
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
            `Goal: ${goalAmount}`
          )
        : null,
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
        'Access your campaign dashboard to add participants, track progress, and share referral links.'
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
        'View Campaign Dashboard'
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
        'Need help getting started? Our fundraising team is here to support you every step of the way.'
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
