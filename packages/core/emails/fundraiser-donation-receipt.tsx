import { Text, Section, Row, Column, Hr } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { Button } from './components/Button'

interface FundraiserDonationReceiptProps {
  donorName?: string | null
  teamName: string
  teamSchool: string
  teamPageUrl: string
  amountFormatted: string
  receiptDate: string
  receiptId: string
  comment?: string | null
  isAnonymous?: boolean
  unsubscribeUrl?: string
}

const section: React.CSSProperties = { padding: '0 24px' }
const heading: React.CSSProperties = {
  margin: '24px 0 16px',
  fontSize: '24px',
  fontWeight: 700,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: 1.3,
}
const paragraph: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '16px',
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: 1.6,
}
const detailsCard: React.CSSProperties = {
  padding: '24px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  margin: '16px 24px 24px',
}
const detailLabel: React.CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  fontFamily: 'Arial, sans-serif',
}
const detailValue: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#111827',
  fontFamily: 'Arial, sans-serif',
}
const amountValue: React.CSSProperties = {
  ...detailValue,
  fontSize: '28px',
  color: '#16a34a',
}

export const FundraiserDonationReceipt = ({
  donorName,
  teamName,
  teamSchool,
  teamPageUrl,
  amountFormatted,
  receiptDate,
  receiptId,
  comment,
  isAnonymous = false,
  unsubscribeUrl = '#',
}: FundraiserDonationReceiptProps) => {
  const previewText = `Thank you for supporting ${teamName}! ${amountFormatted} received.`
  const greeting =
    donorName && !isAnonymous ? `Hi ${donorName},` : 'Hi friend,'

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader />

      <Section style={section}>
        <Text style={heading}>Thanks for your support!</Text>
        <Text style={paragraph}>{greeting}</Text>
        <Text style={paragraph}>
          Your donation to <strong>{teamName}</strong> ({teamSchool}) has
          been received. Every dollar powers their warrior in the Jose
          Madrid Salsa Fundraiser Battle Arena.
        </Text>
      </Section>

      <Section style={detailsCard}>
        <Row>
          <Column style={{ paddingBottom: '12px' }}>
            <Text style={detailLabel}>You contributed</Text>
            <Text style={amountValue}>{amountFormatted}</Text>
          </Column>
        </Row>
        <Hr style={{ borderColor: '#e5e7eb', margin: '8px 0 16px' }} />
        <Row>
          <Column style={{ paddingRight: '12px' }}>
            <Text style={detailLabel}>Team</Text>
            <Text style={detailValue}>{teamName}</Text>
          </Column>
          <Column>
            <Text style={detailLabel}>Date</Text>
            <Text style={detailValue}>{receiptDate}</Text>
          </Column>
        </Row>
        <Row style={{ marginTop: '8px' }}>
          <Column>
            <Text style={detailLabel}>Receipt ID</Text>
            <Text
              style={{
                ...detailValue,
                fontFamily: 'Courier New, monospace',
                fontSize: '12px',
                color: '#4b5563',
              }}
            >
              {receiptId}
            </Text>
          </Column>
        </Row>
      </Section>

      {comment && (
        <Section style={section}>
          <Text style={detailLabel}>Your note to the team</Text>
          <Text
            style={{
              ...paragraph,
              padding: '12px 16px',
              background: '#fef3c7',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '4px',
              fontStyle: 'italic',
            }}
          >
            “{comment}”
          </Text>
        </Section>
      )}

      <Section style={{ ...section, textAlign: 'center', padding: '8px 24px 32px' }}>
        <Button href={teamPageUrl}>Visit {teamName}&apos;s page</Button>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  )
}

export default FundraiserDonationReceipt
