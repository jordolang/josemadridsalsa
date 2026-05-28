import { Text, Section, Row, Column, Hr } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { bodyContent } from './styles'

interface RefundProcessedEmailProps {
  name?: string
  orderNumber: string
  refundAmount: string
  refundMethod: string
  originalOrderDate: string
  processingDays?: string
  unsubscribeUrl?: string
}

export const RefundProcessedEmail = ({
  name = 'there',
  orderNumber,
  refundAmount,
  refundMethod,
  originalOrderDate,
  processingDays = '3–5 business days',
  unsubscribeUrl = '#',
}: RefundProcessedEmailProps) => {
  const previewText = `Refund of ${refundAmount} processed for order #${orderNumber}`

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="refund-processed.png" headerAlt="Refund Processed" />

      <Section style={bodyContent}>
        <Section style={section}>
          <Text style={heading}>Refund Processed</Text>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Your refund for order <strong>#{orderNumber}</strong> has been processed.
          </Text>
        </Section>

        <Section style={detailsBox}>
          <Row style={detailRow}>
            <Column style={detailLabel}><Text style={labelText}>Refund Amount:</Text></Column>
            <Column style={detailValue}><Text style={amountText}>{refundAmount}</Text></Column>
          </Row>
          <Hr style={innerDivider} />
          <Row style={detailRow}>
            <Column style={detailLabel}><Text style={labelText}>Refund Method:</Text></Column>
            <Column style={detailValue}><Text style={valueText}>{refundMethod}</Text></Column>
          </Row>
          <Hr style={innerDivider} />
          <Row style={detailRow}>
            <Column style={detailLabel}><Text style={labelText}>Original Order Date:</Text></Column>
            <Column style={detailValue}><Text style={valueText}>{originalOrderDate}</Text></Column>
          </Row>
        </Section>

        <Section style={timelineBox}>
          <Text style={timelineTitle}>Processing Time</Text>
          <Text style={timelineText}>
            Please allow <strong>{processingDays}</strong> for the refund to appear in your account,
            depending on your financial institution.
          </Text>
        </Section>

        <Hr style={divider} />

        <Section style={supportSection}>
          <Text style={supportText}>
            Questions about your refund?{' '}
            <a href="mailto:support@josemadridsalsa.com" style={link}>
              support@josemadridsalsa.com
            </a>
          </Text>
        </Section>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  )
}

export default RefundProcessedEmail

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
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const detailRow = { marginBottom: '0' }

const innerDivider = { borderColor: '#e2e8f0', margin: '12px 0' }

const detailLabel = { verticalAlign: 'middle' as const, width: '45%' }
const detailValue = { verticalAlign: 'middle' as const, width: '55%', textAlign: 'right' as const }

const labelText = {
  margin: '0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
}

const valueText = {
  margin: '0',
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
}

const amountText = {
  ...valueText,
  fontSize: '18px',
  color: '#16a34a',
}

const timelineBox = {
  backgroundColor: '#fef9c3',
  borderLeft: '4px solid #f59e0b',
  padding: '20px',
  margin: '24px 0',
  borderRadius: '0 6px 6px 0',
}

const timelineTitle = {
  margin: '0 0 8px',
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#92400e',
  fontFamily: 'Arial, sans-serif',
}

const timelineText = {
  margin: '0',
  fontSize: '14px',
  color: '#92400e',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
}

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
