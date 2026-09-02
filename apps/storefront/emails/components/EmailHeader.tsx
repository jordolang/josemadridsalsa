import { Section, Img, Text, Hr } from '@react-email/components';
import { getImageBaseUrl, getLogoUrl } from '@/lib/email/shared/components';

interface EmailHeaderProps {
  logoUrl?: string;
  companyName?: string;
  tagline?: string;
  headerImage?: string;
  headerAlt?: string;
}

const IMAGE_BASE_URL = getImageBaseUrl();

export const EmailHeader = ({
  logoUrl = getLogoUrl(),
  companyName = 'Jose Madrid Salsa',
  tagline = 'Authentic homemade salsa delivered to your door',
  headerImage,
  headerAlt = 'Jose Madrid Salsa',
}: EmailHeaderProps) => {
  if (headerImage) {
    return (
      <Section style={headerImageSection}>
        <Img
          src={`${IMAGE_BASE_URL}/${headerImage}`}
          alt={headerAlt}
          width="600"
          style={headerImg}
        />
      </Section>
    );
  }

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

const headerImageSection = {
  padding: '0',
  margin: '0',
  textAlign: 'center' as const,
  width: '100%',
};

const headerImg = {
  display: 'block' as const,
  width: '100%',
  maxWidth: '600px',
  height: 'auto',
  margin: '0',
  padding: '0',
  border: '0',
  outline: 'none',
};
