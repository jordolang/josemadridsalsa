import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { EmailHeader } from './components/EmailHeader';
import { EmailFooter } from './components/EmailFooter';
import { OrderItemsTable, OrderItem } from './components/OrderItemsTable';
import { Button } from './components/Button';
import { bodyContent } from './styles';

interface ShippingNotificationEmailProps {
  name?: string;
  orderNumber: string;
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  estimatedDelivery: string;
  shippingAddress: string;
  items: OrderItem[];
  unsubscribeUrl?: string;
}

export const ShippingNotificationEmail = ({
  name = 'there',
  orderNumber,
  trackingNumber,
  trackingUrl,
  carrier,
  estimatedDelivery,
  shippingAddress,
  items = [],
  unsubscribeUrl = '#',
}: ShippingNotificationEmailProps) => {
  const previewText = `Order #${orderNumber} has shipped - Track your delivery!`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="shipping-notification.png" headerAlt="Your Order Has Shipped" />

      <Section style={bodyContent}>
        {/* Greeting */}
        <Section style={section}>
          <Text style={heading}>
            Your Order Has Shipped!
          </Text>
          <Text style={paragraph}>
            Hi {name},
          </Text>
          <Text style={paragraph}>
            Great news! Your Jose Madrid Salsa order is on its way to you. We hope you enjoy it!
          </Text>
        </Section>

        {/* Tracking Information */}
        <Section style={trackingSection}>
          <Text style={sectionHeading}>
            Tracking Information
          </Text>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Tracking Number:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{trackingNumber}</Text>
            </Column>
          </Row>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Carrier:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{carrier}</Text>
            </Column>
          </Row>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Estimated Delivery:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{estimatedDelivery}</Text>
            </Column>
          </Row>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Shipping To:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{shippingAddress}</Text>
            </Column>
          </Row>
        </Section>

        {/* Track Shipment CTA */}
        <Section style={ctaSection}>
          <Button href={trackingUrl} variant="primary" size="medium">
            Track Your Shipment
          </Button>
        </Section>

        <Hr style={divider} />

        {/* Order Details */}
        <Section style={section}>
          <Text style={sectionHeading}>
            Order #{orderNumber}
          </Text>
          <OrderItemsTable items={items} />
        </Section>

        <Hr style={divider} />

        {/* Support Message */}
        <Section style={supportSection}>
          <Text style={supportText}>
            Questions about your shipment? We&apos;re here to help! Reply to this email or contact us at{' '}
            <a href="mailto:mike@josemadridsalsa.com" style={link}>
              mike@josemadridsalsa.com
            </a>
          </Text>
        </Section>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  );
};

export default ShippingNotificationEmail;

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

const trackingSection = {
  padding: '20px',
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  margin: '24px 0',
  border: '2px solid #22c55e',
};

const detailRow = {
  marginBottom: '12px',
  width: '100%',
};

const detailLabel = {
  verticalAlign: 'top' as const,
  width: '40%',
};

const detailValue = {
  verticalAlign: 'top' as const,
  width: '60%',
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

const divider = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const ctaSection = {
  padding: '24px 0',
  textAlign: 'center' as const,
};

const supportSection = {
  padding: '24px 0 0',
  margin: '0',
};

const supportText = {
  margin: '0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
  textAlign: 'center' as const,
};

const link = {
  color: '#3b82f6',
  textDecoration: 'none',
};
