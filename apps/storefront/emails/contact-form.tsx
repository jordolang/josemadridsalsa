import { Text, Section, Row, Column, Link, Img } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { SITE_URL } from '@/lib/site-url'

interface ContactFormEmailProps {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message: string;
  storeName?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || SITE_URL;

export const ContactFormEmail = ({
  name,
  email,
  company,
  phone,
  message,
  storeName = 'Jose Madrid Salsa',
}: ContactFormEmailProps) => (
  <EmailLayout previewText={`A user has submitted the contact form on ${storeName}`}>
    <Section style={logoSection}>
      <Img
        src={`${BASE_URL}/images/shared/jose-madrid-salsa-logo.png`}
        alt={storeName}
        width="200"
        style={logo}
      />
    </Section>

    <IconRule glyph="&#128722;" label="Cart" />

    <Section style={body}>
      <Text style={heading}>Contact form submission</Text>
      <Text style={paragraph}>A user has submitted the contact form on {storeName}</Text>

      <Text style={subheading}>Details</Text>

      <DetailRow label="Full Name:" value={name} />
      <DetailRow
        label="Email Address:"
        value={
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>
        }
      />
      {company ? <DetailRow label="Company name:" value={company} /> : null}
      {phone ? <DetailRow label="Phone number:" value={phone} /> : null}

      <Text style={commentsLabel}>Comments / questions:</Text>
      <Text style={commentsText}>{message}</Text>
    </Section>

    <IconRule glyph="&#127978;" label="Store" />

    <Section style={ctaSection}>
      <Link href={BASE_URL} style={openStoreButton}>
        Open store
      </Link>
    </Section>
  </EmailLayout>
);

export default ContactFormEmail;

/** Label/value pair rendered as a two-column row, matching the storefront notification layout. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Row style={detailRow}>
      <Column style={detailLabelCell}>
        <Text style={labelText}>{label}</Text>
      </Column>
      <Column style={detailValueCell}>
        <Text style={valueText}>{value}</Text>
      </Column>
    </Row>
  );
}

/** Horizontal rule broken by a circular glyph badge in the centre. */
function IconRule({ glyph, label }: { glyph: string; label: string }) {
  return (
    <Section style={ruleSection}>
      <Row>
        <Column style={ruleLineCell}>
          <div style={ruleLine} />
        </Column>
        <Column style={ruleBadgeCell}>
          <Text style={ruleBadge} aria-label={label}>
            {glyph}
          </Text>
        </Column>
        <Column style={ruleLineCell}>
          <div style={ruleLine} />
        </Column>
      </Row>
    </Section>
  );
}

const logoSection = {
  padding: '32px 48px 8px',
  textAlign: 'center' as const,
};

const logo = {
  display: 'block',
  margin: '0 auto',
  height: 'auto',
};

const ruleSection = {
  padding: '0 48px',
  margin: '8px 0',
};

const ruleLineCell = {
  verticalAlign: 'middle' as const,
};

const ruleLine = {
  borderBottom: '1px solid #e2e8f0',
  fontSize: '1px',
  lineHeight: '1px',
  height: '1px',
};

const ruleBadgeCell = {
  width: '56px',
  textAlign: 'center' as const,
};

const ruleBadge = {
  margin: '0 auto',
  width: '40px',
  height: '40px',
  lineHeight: '40px',
  fontSize: '18px',
  textAlign: 'center' as const,
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  color: '#94a3b8',
};

const body = {
  padding: '24px 48px 8px',
};

const heading = {
  margin: '0 0 24px',
  fontSize: '30px',
  fontWeight: '600' as const,
  color: '#1f2937',
  lineHeight: '1.25',
};

const paragraph = {
  margin: '0 0 32px',
  fontSize: '16px',
  color: '#1f2937',
  lineHeight: '1.6',
};

const subheading = {
  margin: '0 0 20px',
  fontSize: '22px',
  fontWeight: '600' as const,
  color: '#1f2937',
  lineHeight: '1.3',
};

const detailRow = {
  width: '100%',
};

const detailLabelCell = {
  verticalAlign: 'top' as const,
  width: '40%',
  paddingBottom: '8px',
};

const detailValueCell = {
  verticalAlign: 'top' as const,
  width: '60%',
  paddingBottom: '8px',
};

const labelText = {
  margin: '0',
  fontSize: '15px',
  color: '#1f2937',
  lineHeight: '1.5',
};

const valueText = {
  margin: '0',
  fontSize: '15px',
  fontWeight: '700' as const,
  color: '#1f2937',
  lineHeight: '1.5',
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const commentsLabel = {
  margin: '8px 0 12px',
  fontSize: '15px',
  color: '#1f2937',
  lineHeight: '1.5',
};

const commentsText = {
  margin: '0 0 24px',
  fontSize: '15px',
  fontWeight: '700' as const,
  color: '#1f2937',
  lineHeight: '1.7',
  whiteSpace: 'pre-wrap' as const,
};

const ctaSection = {
  padding: '8px 48px 40px',
  textAlign: 'center' as const,
};

const openStoreButton = {
  display: 'inline-block',
  padding: '12px 28px',
  fontSize: '15px',
  color: '#1f2937',
  textDecoration: 'none',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
};
