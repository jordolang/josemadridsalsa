import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { EmailHeader } from './components/EmailHeader';
import { EmailFooter } from './components/EmailFooter';
import { Button } from './components/Button';

interface ContactFormEmailProps {
  name: string;
  email: string;
  phone?: string;
  message: string;
  submittedAt?: string;
  unsubscribeUrl?: string;
}

export const ContactFormEmail = ({
  name,
  email,
  phone,
  message,
  submittedAt,
  unsubscribeUrl = '#',
}: ContactFormEmailProps) => {
  const previewText = `New contact form submission from ${name}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="email-header.png" headerAlt="Jose Madrid Salsa" />

      {/* Heading */}
      <Section style={section}>
        <Text style={heading}>
          New Contact Form Submission
        </Text>
        <Text style={paragraph}>
          You&apos;ve received a new message through the contact form.
        </Text>
      </Section>

      {/* Contact Details */}
      <Section style={detailsSection}>
        <Text style={sectionHeading}>
          Contact Information
        </Text>
        <Row style={detailRow}>
          <Column style={detailLabel}>
            <Text style={labelText}>Name:</Text>
          </Column>
          <Column style={detailValue}>
            <Text style={valueText}>{name}</Text>
          </Column>
        </Row>
        <Row style={detailRow}>
          <Column style={detailLabel}>
            <Text style={labelText}>Email:</Text>
          </Column>
          <Column style={detailValue}>
            <Text style={valueText}>
              <a href={`mailto:${email}`} style={emailLink}>{email}</a>
            </Text>
          </Column>
        </Row>
        {phone && (
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Phone:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{phone}</Text>
            </Column>
          </Row>
        )}
        {submittedAt && (
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Submitted:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{submittedAt}</Text>
            </Column>
          </Row>
        )}
      </Section>

      <Hr style={divider} />

      {/* Message Content */}
      <Section style={messageSection}>
        <Text style={sectionHeading}>
          Message
        </Text>
        <Section style={messageBox}>
          <Text style={messageText}>
            {message}
          </Text>
        </Section>
      </Section>

      <Hr style={divider} />

      {/* Call to Action */}
      <Section style={ctaSection}>
        <Text style={paragraph}>
          Reply to this message by clicking the button below:
        </Text>
        <Button href={`mailto:${email}`} variant="primary" size="medium">
          Reply to {name}
        </Button>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  );
};

export default ContactFormEmail;

const section = {
  padding: '0',
  margin: '24px 0',
};

const heading = {
  margin: '0 0 24px',
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.3',
};

const paragraph = {
  margin: '0 0 16px',
  fontSize: '16px',
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
};

const sectionHeading = {
  margin: '0 0 16px',
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.4',
};

const detailsSection = {
  padding: '20px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  margin: '24px 0',
};

const detailRow = {
  marginBottom: '12px',
  width: '100%',
};

const detailLabel = {
  verticalAlign: 'top' as const,
  width: '30%',
};

const detailValue = {
  verticalAlign: 'top' as const,
  width: '70%',
};

const labelText = {
  margin: '0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const valueText = {
  margin: '0',
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const emailLink = {
  color: '#3b82f6',
  textDecoration: 'none',
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const messageSection = {
  padding: '0',
  margin: '24px 0',
};

const messageBox = {
  padding: '20px',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  margin: '0',
};

const messageText = {
  margin: '0',
  fontSize: '15px',
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap' as const,
};

const ctaSection = {
  padding: '24px 0',
  textAlign: 'center' as const,
};
