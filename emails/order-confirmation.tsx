import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { EmailHeader } from './components/EmailHeader';
import { EmailFooter } from './components/EmailFooter';
import { OrderItemsTable, OrderItem } from './components/OrderItemsTable';
import { Button } from './components/Button';

interface OrderConfirmationEmailProps {
  name?: string;
  orderNumber: string;
  orderDate: string;
  orderTotal: string;
  items: OrderItem[];
  shippingAddress: string;
  trackingLink?: string;
  unsubscribeUrl?: string;
}

export const OrderConfirmationEmail = ({
  name = 'there',
  orderNumber,
  orderDate,
  orderTotal,
  items = [],
  shippingAddress,
  trackingLink,
  unsubscribeUrl = '#',
}: OrderConfirmationEmailProps) => {
  const previewText = `Order #${orderNumber} confirmed - Thanks for your order!`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader />

      {/* Greeting */}
      <Section style={section}>
        <Text style={heading}>
          Order Confirmed!
        </Text>
        <Text style={paragraph}>
          Hi {name},
        </Text>
        <Text style={paragraph}>
          Thanks for your order! We&apos;re excited to get your delicious Jose Madrid Salsa on its way to you.
        </Text>
      </Section>

      {/* Order Details */}
      <Section style={orderDetailsSection}>
        <Text style={sectionHeading}>
          Order Details
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
            <Text style={labelText}>Order Date:</Text>
          </Column>
          <Column style={detailValue}>
            <Text style={valueText}>{orderDate}</Text>
          </Column>
        </Row>
        <Row style={detailRow}>
          <Column style={detailLabel}>
            <Text style={labelText}>Shipping:</Text>
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
          Order Items
        </Text>
        <OrderItemsTable items={items} />
      </Section>

      <Hr style={divider} />

      {/* Order Total */}
      <Section style={totalSection}>
        <Row>
          <Column style={totalLabel}>
            <Text style={totalLabelText}>Total:</Text>
          </Column>
          <Column style={totalValue}>
            <Text style={totalValueText}>{orderTotal}</Text>
          </Column>
        </Row>
      </Section>

      <Hr style={divider} />

      {/* Tracking Link / Call to Action */}
      {trackingLink && (
        <Section style={ctaSection}>
          <Text style={paragraph}>
            Track your order or view your order history in your account.
          </Text>
          <Button href={trackingLink} variant="primary" size="medium">
            Track Order
          </Button>
        </Section>
      )}

      {/* Support Message */}
      <Section style={supportSection}>
        <Text style={supportText}>
          Questions about your order? We&apos;re here to help! Reply to this email or contact us at{' '}
          <a href="mailto:orders@josemadridsalsa.com" style={link}>
            orders@josemadridsalsa.com
          </a>
        </Text>
      </Section>

      <EmailFooter unsubscribeUrl={unsubscribeUrl} />
    </EmailLayout>
  );
};

export default OrderConfirmationEmail;

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

const orderDetailsSection = {
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
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const totalSection = {
  padding: '16px 0',
  margin: '0',
};

const totalLabel = {
  verticalAlign: 'middle' as const,
  textAlign: 'right' as const,
  paddingRight: '16px',
};

const totalValue = {
  verticalAlign: 'middle' as const,
  textAlign: 'right' as const,
  width: '120px',
};

const totalLabelText = {
  margin: '0',
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const totalValueText = {
  margin: '0',
  fontSize: '20px',
  fontWeight: '700' as const,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
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
