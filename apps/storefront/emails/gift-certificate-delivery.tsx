import { Text, Section, Hr } from '@react-email/components'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHeader } from '@/emails/components/EmailHeader'
import { EmailFooter } from '@/emails/components/EmailFooter'
import { Button } from '@/emails/components/Button'
import { bodyContent } from '@/emails/styles'
import { SITE_DOMAIN } from '@/lib/site-url'

interface GiftCertificateDeliveryEmailProps {
  recipientName?: string
  purchaserName: string
  code: string
  amount: string
  message?: string
  redeemUrl: string
  unsubscribeUrl?: string
}

export const GiftCertificateDeliveryEmail = ({
  recipientName = 'there',
  purchaserName,
  code,
  amount,
  message,
  redeemUrl,
  unsubscribeUrl = '#',
}: GiftCertificateDeliveryEmailProps) => {
  const previewText = `${purchaserName} sent you a ${amount} José Madrid Salsa gift certificate!`

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="email-header.png" headerAlt="You've Received a Gift!" />

      <Section style={bodyContent}>
        <Section style={section}>
          <Text style={heading}>You&apos;ve Got a Gift! 🎁</Text>
          <Text style={paragraph}>Hi {recipientName},</Text>
          <Text style={paragraph}>
            <strong>{purchaserName}</strong> has sent you a José Madrid Salsa gift certificate.
            Time to treat yourself to some of Ohio&apos;s finest handcrafted salsa!
          </Text>
        </Section>

        <Section style={giftBox}>
          <Text style={giftLabel}>Gift Certificate Value</Text>
          <Text style={giftAmount}>{amount}</Text>
          <Section style={codeBox}>
            <Text style={codeLabel}>Your Code</Text>
            <Text style={codeText}>{code}</Text>
          </Section>
        </Section>

        {message && (
          <Section style={messageBox}>
            <Text style={messageLabel}>A note from {purchaserName}:</Text>
            <Text style={messageText}>&ldquo;{message}&rdquo;</Text>
          </Section>
        )}

        <Section style={ctaSection}>
          <Button href={redeemUrl} variant="primary" size="medium">
            Shop Now &amp; Redeem Your Gift
          </Button>
        </Section>

        <Hr style={divider} />

        <Section style={howToSection}>
          <Text style={howToTitle}>How to use your gift certificate:</Text>
          <Text style={howToStep}>1. Browse our full collection at {SITE_DOMAIN}</Text>
          <Text style={howToStep}>2. Add your favorites to the cart</Text>
          <Text style={howToStep}>3. Enter code <strong>{code}</strong> at checkout</Text>
          <Text style={howToStep}>4. Enjoy! Gift certificates never expire.</Text>
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

export default GiftCertificateDeliveryEmail

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

const giftBox = {
  backgroundColor: '#fef9f0',
  border: '2px solid #f59e0b',
  borderRadius: '12px',
  padding: '32px',
  margin: '24px 0',
  textAlign: 'center' as const,
}

const giftLabel = {
  margin: '0 0 8px',
  fontSize: '12px',
  color: '#92400e',
  fontFamily: 'Arial, sans-serif',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  fontWeight: '600' as const,
}

const giftAmount = {
  margin: '0 0 20px',
  fontSize: '42px',
  fontWeight: '700' as const,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.2',
}

const codeBox = {
  backgroundColor: '#ffffff',
  border: '2px dashed #f59e0b',
  borderRadius: '8px',
  padding: '16px',
  display: 'inline-block',
}

const codeLabel = {
  margin: '0 0 4px',
  fontSize: '11px',
  color: '#92400e',
  fontFamily: 'Arial, sans-serif',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
}

const codeText = {
  margin: '0',
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1f2937',
  fontFamily: 'monospace',
  letterSpacing: '3px',
}

const messageBox = {
  backgroundColor: '#f0fdf4',
  borderLeft: '4px solid #16a34a',
  padding: '20px',
  margin: '24px 0',
  borderRadius: '0 8px 8px 0',
}

const messageLabel = {
  margin: '0 0 8px',
  fontSize: '13px',
  color: '#166534',
  fontFamily: 'Arial, sans-serif',
  fontWeight: '600' as const,
}

const messageText = {
  margin: '0',
  fontSize: '16px',
  color: '#166534',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
  fontStyle: 'italic' as const,
}

const ctaSection = { padding: '24px 0', textAlign: 'center' as const }

const divider = { borderColor: '#e2e8f0', margin: '24px 0' }

const howToSection = { padding: '0', margin: '0 0 24px' }

const howToTitle = {
  margin: '0 0 12px',
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
}

const howToStep = {
  margin: '0 0 8px',
  fontSize: '14px',
  color: '#4b5563',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
}

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
