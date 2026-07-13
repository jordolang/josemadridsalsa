import { Text, Section, Hr } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { Button } from './components/Button'
import { bodyContent } from './styles'

interface ProductReviewRequestEmailProps {
  name?: string
  productName: string
  orderNumber: string
  reviewUrl: string
  unsubscribeUrl?: string
}

export const ProductReviewRequestEmail = ({
  name = 'there',
  productName,
  orderNumber,
  reviewUrl,
  unsubscribeUrl = '#',
}: ProductReviewRequestEmailProps) => {
  const previewText = `How did you like ${productName}? Share your thoughts!`

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="review-request.png" headerAlt="How Did We Do?" />

      <Section style={bodyContent}>
        <Section style={section}>
          <Text style={heading}>How Did You Like It?</Text>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            It&apos;s been a few days since your order <strong>#{orderNumber}</strong> arrived.
            We hope you&apos;re enjoying <strong>{productName}</strong>!
          </Text>
          <Text style={paragraph}>
            Reviews help other salsa lovers find the flavors they&apos;ll love. It only takes
            a minute — and we read every one.
          </Text>
        </Section>

        <Section style={starsBox}>
          <Text style={starsText}>⭐⭐⭐⭐⭐</Text>
          <Text style={starsCaption}>How would you rate {productName}?</Text>
        </Section>

        <Section style={ctaSection}>
          <Button href={reviewUrl} variant="primary" size="medium">
            Leave a Review
          </Button>
        </Section>

        <Hr style={divider} />

        <Section style={supportSection}>
          <Text style={supportText}>
            Something wasn&apos;t right with your order?{' '}
            <a href="mailto:mike@josemadridsalsa.com" style={link}>
              Let us know
            </a>{' '}
            and we&apos;ll make it right.
          </Text>
        </Section>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  )
}

export default ProductReviewRequestEmail

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

const starsBox = {
  backgroundColor: '#fef9f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
  textAlign: 'center' as const,
}

const starsText = {
  margin: '0 0 8px',
  fontSize: '32px',
  lineHeight: '1',
}

const starsCaption = {
  margin: '0',
  fontSize: '15px',
  color: '#92400e',
  fontFamily: 'Arial, sans-serif',
  fontWeight: '600' as const,
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
