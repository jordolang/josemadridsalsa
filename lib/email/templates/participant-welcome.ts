import React from 'react'
import { Text, Section } from '@react-email/components'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHeader } from '@/emails/components/EmailHeader'
import { EmailFooter } from '@/emails/components/EmailFooter'
import { Button } from '@/emails/components/Button'

interface ParticipantWelcomeEmailProps {
  participantName: string
  fundraiserName: string
  referralCode: string
  fundraiserUrl: string
  supportEmail?: string
  unsubscribeUrl: string
}

export function ParticipantWelcomeEmail({
  participantName,
  fundraiserName,
  referralCode,
  fundraiserUrl,
  supportEmail = 'fundraising@josemadridsalsa.com',
  unsubscribeUrl,
}: ParticipantWelcomeEmailProps) {
  const previewText = `Welcome to the ${fundraiserName} fundraiser!`

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
        `Welcome to ${fundraiserName}!`
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
        `You've been added as a participant to the ${fundraiserName} fundraiser! We're excited to have you on board.`
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
        'Your Referral Code:'
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '20px',
            fontWeight: '700',
            color: '#dc2626',
            fontFamily: 'monospace',
            lineHeight: '1.6',
            letterSpacing: '2px',
          },
        },
        referralCode
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
        'Share your unique referral code with friends and family. Every order placed using your code helps support the fundraiser!'
      )
    ),
    React.createElement(
      Section,
      { style: { padding: '24px 0', textAlign: 'center' as const } },
      React.createElement(
        Button,
        {
          href: fundraiserUrl,
          variant: 'primary',
          size: 'medium',
        },
        'View Fundraiser Details'
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
            fontWeight: '600',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        'How It Works:'
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
        '1. Share your referral code with supporters'
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
        '2. They use your code when making a purchase'
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
        '3. Track your impact and help reach the fundraising goal'
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
        `Questions? Contact us at ${supportEmail}.`
      )
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )
}
