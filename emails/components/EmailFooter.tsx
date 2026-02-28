import { Section, Text, Link, Hr } from '@react-email/components';

interface EmailFooterProps {
  companyName?: string;
  companyAddress?: string;
  unsubscribeUrl?: string;
  supportEmail?: string;
  privacyUrl?: string;
  termsUrl?: string;
}

export const EmailFooter = ({
  companyName = 'Jose Madrid Salsa',
  companyAddress = '123 Main Street, Austin, TX 78701',
  unsubscribeUrl,
  supportEmail = 'support@josemadrid.net',
  privacyUrl = 'https://josemadrid.net/privacy',
  termsUrl = 'https://josemadrid.net/terms',
}: EmailFooterProps) => {
  return (
    <>
      <Hr style={divider} />
      <Section style={footer}>
        <Text style={footerText}>
          {companyName}
        </Text>
        <Text style={footerText}>
          {companyAddress}
        </Text>
        <Text style={footerText}>
          Questions? Email us at{' '}
          <Link href={`mailto:${supportEmail}`} style={link}>
            {supportEmail}
          </Link>
        </Text>
        <Text style={footerTextSmall}>
          {unsubscribeUrl && (
            <>
              <Link href={unsubscribeUrl} style={link}>
                Unsubscribe
              </Link>
              {' · '}
            </>
          )}
          <Link href={privacyUrl} style={link}>
            Privacy Policy
          </Link>
          {' · '}
          <Link href={termsUrl} style={link}>
            Terms of Service
          </Link>
        </Text>
        <Text style={copyright}>
          © {new Date().getFullYear()} {companyName}. All rights reserved.
        </Text>
      </Section>
    </>
  );
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '40px 0 0',
};

const footer = {
  padding: '32px 20px',
  textAlign: 'center' as const,
  backgroundColor: '#f8fafc',
};

const footerText = {
  margin: '8px 0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
  textAlign: 'center' as const,
};

const footerTextSmall = {
  margin: '16px 0 8px',
  fontSize: '12px',
  color: '#94a3b8',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
  textAlign: 'center' as const,
};

const link = {
  color: '#3b82f6',
  textDecoration: 'none',
};

const copyright = {
  margin: '16px 0 0',
  fontSize: '12px',
  color: '#94a3b8',
  fontFamily: 'Arial, sans-serif',
  textAlign: 'center' as const,
};
