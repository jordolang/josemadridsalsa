import { Text, Section, Hr } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { Button } from './components/Button'
import { bodyContent } from './styles'

interface AccountWelcomeEmailProps {
  name?: string
  shopUrl?: string
  accountUrl?: string
  unsubscribeUrl?: string
}

export const AccountWelcomeEmail = ({
  name = 'there',
  shopUrl = 'https://josemadrid.net/products',
  accountUrl = 'https://josemadrid.net/account',
  unsubscribeUrl = '#',
}: AccountWelcomeEmailProps) => {
  const previewText = `Welcome to José Madrid Salsa, ${name}!`

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="welcome.png" headerAlt="Welcome to José Madrid Salsa" />

      <Section style={bodyContent}>
        <Section style={section}>
          <Text style={heading}>Welcome to the Family! 🌶️</Text>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Thanks for creating an account with José Madrid Salsa. We&apos;ve been crafting
            handcrafted gourmet salsas in Zanesville, Ohio since 1988 — and we&apos;re thrilled
            to have you here.
          </Text>
        </Section>

        <Section style={benefitsBox}>
          <Text style={benefitsTitle}>What you get with your account:</Text>
          <Text style={benefitItem}>✓ Track and manage your orders in one place</Text>
          <Text style={benefitItem}>✓ Save shipping addresses for faster checkout</Text>
          <Text style={benefitItem}>✓ Earn loyalty points on every purchase</Text>
          <Text style={benefitItem}>✓ Exclusive member discounts and early access</Text>
          <Text style={benefitItem}>✓ Leave reviews and help others find great salsa</Text>
        </Section>

        <Section style={ctaSection}>
          <Button href={shopUrl} variant="primary" size="medium">
            Start Shopping
          </Button>
        </Section>

        <Hr style={divider} />

        <Section style={footerNote}>
          <Text style={supportText}>
            You can manage your account at any time at{' '}
            <a href={accountUrl} style={link}>
              josemadrid.net/account
            </a>
            . Questions?{' '}
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

export default AccountWelcomeEmail

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

const benefitsBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const benefitsTitle = {
  margin: '0 0 12px',
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#166534',
  fontFamily: 'Arial, sans-serif',
}

const benefitItem = {
  margin: '0 0 8px',
  fontSize: '14px',
  color: '#166534',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
}

const ctaSection = { padding: '24px 0', textAlign: 'center' as const }

const divider = { borderColor: '#e2e8f0', margin: '24px 0' }

const footerNote = { padding: '0' }

const supportText = {
  margin: '0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
  textAlign: 'center' as const,
}

const link = { color: '#3b82f6', textDecoration: 'none' }
