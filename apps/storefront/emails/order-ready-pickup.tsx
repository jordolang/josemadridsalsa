import { Text, Section, Hr } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { Button } from './components/Button'
import { bodyContent } from './styles'
import { SITE_URL } from '@/lib/site-url'

interface OrderReadyPickupEmailProps {
  name?: string
  orderNumber: string
  pickupLocation?: string
  pickupHours?: string
  pickupDeadline?: string
  unsubscribeUrl?: string
}

export const OrderReadyPickupEmail = ({
  name = 'there',
  orderNumber,
  pickupLocation = 'José Madrid Salsa, Zanesville, OH',
  pickupHours = 'Mon–Fri 9am–5pm',
  pickupDeadline,
  unsubscribeUrl = '#',
}: OrderReadyPickupEmailProps) => {
  const previewText = `Order #${orderNumber} is ready for pickup!`

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="order-update.png" headerAlt="Your Order is Ready" />

      <Section style={bodyContent}>
        <Section style={section}>
          <Text style={heading}>Your Order is Ready for Pickup! 🎉</Text>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Great news! Your order <strong>#{orderNumber}</strong> is ready and waiting for you.
          </Text>
        </Section>

        <Section style={detailsBox}>
          <Text style={detailTitle}>Pickup Details</Text>
          <Text style={detailItem}>
            <strong>Location:</strong> {pickupLocation}
          </Text>
          <Text style={detailItem}>
            <strong>Hours:</strong> {pickupHours}
          </Text>
          {pickupDeadline && (
            <Text style={detailItem}>
              <strong>Pick up by:</strong> {pickupDeadline}
            </Text>
          )}
        </Section>

        <Section style={reminderBox}>
          <Text style={reminderText}>
            Please bring this email or your order number <strong>#{orderNumber}</strong> when you come to pick up.
          </Text>
        </Section>

        <Section style={ctaSection}>
          <Button href={`${SITE_URL}/account/orders`} variant="primary" size="medium">
            View Order Details
          </Button>
        </Section>

        <Hr style={divider} />

        <Section style={supportSection}>
          <Text style={supportText}>
            Questions?{' '}
            <a href="mailto:mike@josemadridsalsa.com" style={link}>
              mike@josemadridsalsa.com
            </a>{' '}
            · (740) 521-4304
          </Text>
        </Section>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  )
}

export default OrderReadyPickupEmail

const section = { padding: '0', margin: '24px 0' }

const heading = {
  margin: '0 0 24px',
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#16a34a',
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

const detailsBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const detailTitle = {
  margin: '0 0 12px',
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#166534',
  fontFamily: 'Arial, sans-serif',
}

const detailItem = {
  margin: '0 0 8px',
  fontSize: '15px',
  color: '#166534',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
}

const reminderBox = {
  backgroundColor: '#fef9c3',
  borderLeft: '4px solid #f59e0b',
  padding: '16px 20px',
  margin: '0 0 24px',
  borderRadius: '0 6px 6px 0',
}

const reminderText = {
  margin: '0',
  fontSize: '14px',
  color: '#92400e',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
}

const ctaSection = { padding: '8px 0 24px', textAlign: 'center' as const }

const divider = { borderColor: '#e2e8f0', margin: '24px 0' }

const supportSection = { padding: '0' }

const supportText = {
  margin: '0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
  textAlign: 'center' as const,
}

const link = { color: '#3b82f6', textDecoration: 'none' }
