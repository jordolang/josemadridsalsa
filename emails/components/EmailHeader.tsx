import { Section, Img, Text, Hr } from '@react-email/components';

interface EmailHeaderProps {
  logoUrl?: string;
  companyName?: string;
  tagline?: string;
}

export const EmailHeader = ({
  logoUrl = 'https://josemadrid.net/images/logo.png',
  companyName = 'Jose Madrid Salsa',
  tagline = 'Authentic homemade salsa delivered to your door',
}: EmailHeaderProps) => {
  return (
    <>
      <Section style={header}>
        <Img
          src={logoUrl}
          alt={companyName}
          width="180"
          style={logo}
        />
        {tagline && (
          <Text style={taglineText}>
            {tagline}
          </Text>
        )}
      </Section>
      <Hr style={divider} />
    </>
  );
};

const header = {
  padding: '40px 20px',
  textAlign: 'center' as const,
  backgroundColor: '#ffffff',
};

const logo = {
  display: 'block',
  margin: '0 auto',
  height: 'auto',
};

const taglineText = {
  margin: '16px 0 0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  textAlign: 'center' as const,
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '0',
};
