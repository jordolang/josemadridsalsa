import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { EmailHeader } from './components/EmailHeader';
import { EmailFooter } from './components/EmailFooter';
import { OrderItemsTable, OrderItem } from './components/OrderItemsTable';
import { Button } from './components/Button';
import { bodyContent } from './styles';

interface OrderShippedEmailProps {
  name?: string;
  orderNumber: string;
  shippedDate: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery?: string;
  items: OrderItem[];
  shippingAddress: string;
  trackingLink: string;
  unsubscribeUrl?: string;
}

export const OrderShippedEmail = ({
  name = 'there',
  orderNumber,
  shippedDate,
  trackingNumber,
  carrier,
  estimatedDelivery,
  items = [],
  shippingAddress,
  trackingLink,
  unsubscribeUrl = '#',
}: OrderShippedEmailProps) => {
  const previewText = `Order #${orderNumber} has shipped - Track your salsa!`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="order-shipped.png" headerAlt="Order Shipped" />

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
            Great news! Your Jose Madrid Salsa order is on its way to you.
          </Text>
        </Section>

        {/* Shipping Details */}
        <Section style={shippingDetailsSection}>
          <Text style={sectionHeading}>
            Shipping Details
          </Text>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Order Number:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>#{orderNumber}</Text>
            </Column>
          </Row>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Shipped Date:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{shippedDate}</Text>
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
              <Text style={labelText}>Tracking Number:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{trackingNumber}</Text>
            </Column>
          </Row>
          {estimatedDelivery && (
            <Row style={detailRow}>
              <Column style={detailLabel}>
                <Text style={labelText}>Estimated Delivery:</Text>
              </Column>
              <Column style={detailValue}>
                <Text style={valueText}>{estimatedDelivery}</Text>
              </Column>
            </Row>
          )}
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Shipping To:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{shippingAddress}</Text>
            </Column>
          </Row>
        </Section>

        <Hr style={divider} />

        {/* Order Items */}
        <Section style={section}>
          <Text style={sectionHeading}>
            Items in This Shipment
          </Text>
          <OrderItemsTable items={items} />
        </Section>

        <Hr style={divider} />

        {/* Tracking CTA */}
        <Section style={ctaSection}>
          <Text style={paragraph}>
            Track your shipment to see real-time updates on your delivery.
          </Text>
          <Button href={trackingLink} variant="primary" size="medium">
            Track Your Order
          </Button>
        </Section>

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

export default OrderShippedEmail;

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

const shippingDetailsSection = {
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
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
  fontWeight: '600' as const,
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const supportSection = {
  margin: '32px 0 0',
  padding: '20px',
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  borderLeft: '4px solid #f59e0b',
};

const supportText = {
  margin: '0',
  fontSize: '14px',
  color: '#78350f',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.6',
};

const link = {
  color: '#ea580c',
  textDecoration: 'underline',
};
