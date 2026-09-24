import { Text, Section, Hr } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { Button } from './components/Button'
import { bodyContent } from './styles'
import { SITE_URL } from '@/lib/site-url'

interface OrderCancellationEmailProps {
  name?: string
  orderNumber: string
  cancellationDate: string
  unsubscribeUrl?: string
}

export const OrderCancellationEmail = ({
  name = 'there',
  orderNumber,
  cancellationDate,
  unsubscribeUrl = '#',
}: OrderCancellationEmailProps) => {
  const previewText = `Order #${orderNumber} has been cancelled`

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="order-cancellation.png" headerAlt="Order Cancelled" />

      <Section style={bodyContent}>
        <Section style={section}>
          <Text style={heading}>Your Order Has Been Cancelled</Text>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your order <strong>#{orderNumber}</strong> was cancelled on {cancellationDate}.
          </Text>
        </Section>

        <Section style={alertBox}>
          <Text style={alertText}>
            If you did not request this cancellation, please contact us immediately at{' '}
            <a href="mailto:mike@josemadridsalsa.com" style={link}>
              mike@josemadridsalsa.com
            </a>{' '}
            or call (740) 521-4304.
          </Text>
        </Section>

        <Hr style={divider} />

        <Section style={ctaSection}>
          <Text style={paragraph}>
            Changed your mind? We&apos;d love to have you back.
          </Text>
          <Button href={`${SITE_URL}/products`} variant="primary" size="medium">
            Shop Again
          </Button>
        </Section>

        <Section style={supportSection}>
          <Text style={supportText}>
            Questions?{' '}
            <a href="mailto:mike@josemadridsalsa.com" style={link}>
              mike@josemadridsalsa.com
            </a>
          </Text>
        </Section>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  )
}

export default OrderCancellationEmail

const section = { padding: '0', margin: '24px 0' }

const heading = {
  margin: '0 0 24px',
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.3',
}

const paragraph = {
  margin: '0 0 16px',
  fontSize: '16px',
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
}

const alertBox = {
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #dc2626',
  padding: '20px',
  margin: '24px 0',
  borderRadius: '0 6px 6px 0',
}

const alertText = {
  margin: '0',
  fontSize: '14px',
  color: '#991b1b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
}

const divider = { borderColor: '#e2e8f0', margin: '24px 0' }

const ctaSection = { padding: '24px 0', textAlign: 'center' as const }

const supportSection = { padding: '24px 0 0' }

const supportText = {
  margin: '0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
  textAlign: 'center' as const,
}

const link = { color: '#3b82f6', textDecoration: 'none' }
