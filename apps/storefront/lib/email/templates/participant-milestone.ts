import React from 'react'
import { Text, Section } from '@react-email/components'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHeader } from '@/emails/components/EmailHeader'
import { EmailFooter } from '@/emails/components/EmailFooter'
import { Button } from '@/emails/components/Button'

interface ParticipantMilestoneEmailProps {
  participantName: string
  fundraiserName: string
  milestone: number
  totalSales: number
  totalRaised: string
  dashboardUrl: string
  supportEmail?: string
  unsubscribeUrl: string
}

export function ParticipantMilestoneEmail({
  participantName,
  fundraiserName,
  milestone,
  totalSales,
  totalRaised,
  dashboardUrl,
  supportEmail = 'fundraising@josemadridsalsa.com',
  unsubscribeUrl,
}: ParticipantMilestoneEmailProps) {
  const previewText = `Congratulations! You've reached ${milestone} sales!`

  const milestoneMessages: Record<number, string> = {
    1: "You've made your first sale! Amazing start.",
    5: "You've hit 5 sales! You're on a roll.",
    10: "You've reached 10 sales! Incredible impact.",
  }

  const message = milestoneMessages[milestone] || `You've reached ${milestone} sales!`

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
        'Congratulations on Your Milestone! 🎉'
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
        `Hi ${participantName},`
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
        message
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
        'Your Impact:'
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
        `Total Sales: ${totalSales}`
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
        `Total Raised: ${totalRaised}`
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
        `Thank you for your dedication to ${fundraiserName}. Every sale brings us closer to our goal!`
      )
    ),
    React.createElement(
      Section,
      { style: { padding: '24px 0', textAlign: 'center' as const } },
      React.createElement(
        Button,
        {
          href: dashboardUrl,
          variant: 'primary',
          size: 'medium',
        },
        'View Your Dashboard'
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
        'Keep sharing your referral code to continue making an impact!'
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
