import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { EmailHeader } from './components/EmailHeader';
import { EmailFooter } from './components/EmailFooter';
import { OrderItemsTable, OrderItem } from './components/OrderItemsTable';
import { Button } from './components/Button';
import { bodyContent } from './styles';

interface DeliveryConfirmationEmailProps {
  name?: string;
  orderNumber: string;
  deliveryDate: string;
  items: OrderItem[];
  shippingAddress: string;
  feedbackUrl?: string;
  orderDetailsUrl?: string;
  unsubscribeUrl?: string;
}

export const DeliveryConfirmationEmail = ({
  name = 'there',
  orderNumber,
  deliveryDate,
  items = [],
  shippingAddress,
  feedbackUrl,
  orderDetailsUrl,
  unsubscribeUrl = '#',
}: DeliveryConfirmationEmailProps) => {
  const previewText = `Order #${orderNumber} has been delivered - We hope you enjoy!`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="order-delivered.png" headerAlt="Order Delivered" />

      <Section style={bodyContent}>
        {/* Greeting */}
        <Section style={section}>
          <Text style={heading}>
            Your Order Has Been Delivered! 🎉
          </Text>
          <Text style={paragraph}>
            Hi {name},
          </Text>
          <Text style={paragraph}>
            Great news! Your Jose Madrid Salsa order has been delivered. We hope you&apos;re ready to enjoy some delicious salsa!
          </Text>
        </Section>

        {/* Delivery Details */}
        <Section style={deliveryDetailsSection}>
          <Text style={sectionHeading}>
            Delivery Information
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
              <Text style={labelText}>Delivery Date:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{deliveryDate}</Text>
            </Column>
          </Row>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Delivered To:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{shippingAddress}</Text>
            </Column>
          </Row>
        </Section>

        <Hr style={divider} />

        {/* Delivered Items */}
        <Section style={section}>
          <Text style={sectionHeading}>
            Items Delivered
          </Text>
          <OrderItemsTable items={items} />
        </Section>

        <Hr style={divider} />

        {/* Feedback Request */}
        <Section style={feedbackSection}>
          <Text style={feedbackHeading}>
            How Was Your Experience?
          </Text>
          <Text style={paragraph}>
            We&apos;d love to hear what you think! Your feedback helps us improve and helps other salsa lovers discover our products.
          </Text>
          {feedbackUrl && (
            <Section style={ctaButtonContainer}>
              <Button href={feedbackUrl} variant="primary" size="medium">
                Leave a Review
              </Button>
            </Section>
          )}
          {feedbackUrl && (
            <Text style={feedbackSubtext}>
              Your honest opinion means the world to us and takes just a minute to share.
            </Text>
          )}
        </Section>

        <Hr style={divider} />

        {/* Order Details Link */}
        {orderDetailsUrl && (
          <Section style={ctaSection}>
            <Text style={paragraph}>
              Want to view your order details or order history?
            </Text>
            <Button href={orderDetailsUrl} variant="secondary" size="medium">
              View Order Details
            </Button>
          </Section>
        )}

        {/* Support Message */}
        <Section style={supportSection}>
          <Text style={supportText}>
            Any issues with your delivery? We&apos;re here to help! Reply to this email or contact us at{' '}
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

export default DeliveryConfirmationEmail;

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

const deliveryDetailsSection = {
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

const feedbackSection = {
  padding: '24px',
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const feedbackHeading = {
  margin: '0 0 16px',
  fontSize: '20px',
  fontWeight: '700' as const,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.3',
};

const feedbackSubtext = {
  margin: '16px 0 0',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
  fontStyle: 'italic' as const,
};

const ctaButtonContainer = {
  margin: '16px 0',
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
