import { Html, Head, Body, Container, Section, Preview } from '@react-email/components';

interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
}

export const EmailLayout = ({ children, previewText }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={main}>
        <Container style={container}>
          {/* Header section - will be replaced with EmailHeader component */}
          <Section style={header}>
            {/* Placeholder for EmailHeader */}
          </Section>

          {/* Main content */}
          <Section style={content}>
            {children}
          </Section>

          {/* Footer section - will be replaced with EmailFooter component */}
          <Section style={footer}>
            {/* Placeholder for EmailFooter */}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '0',
};

const content = {
  padding: '0 48px',
};

const footer = {
  padding: '0',
};
