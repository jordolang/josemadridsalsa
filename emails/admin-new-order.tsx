import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { EmailHeader } from './components/EmailHeader';
import { EmailFooter } from './components/EmailFooter';
import { OrderItemsTable, OrderItem } from './components/OrderItemsTable';
import { Button } from './components/Button';
import { bodyContent } from './styles';

interface AdminNewOrderEmailProps {
  orderNumber: string;
  orderDate: string;
  orderTotal: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  shippingAddress: string;
  adminPanelUrl: string;
}

export const AdminNewOrderEmail = ({
  orderNumber,
  orderDate,
  orderTotal,
  customerName,
  customerEmail,
  items = [],
  shippingAddress,
  adminPanelUrl,
}: AdminNewOrderEmailProps) => {
  const previewText = `New order #${orderNumber} from ${customerName} - ${orderTotal}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader headerImage="order-confirmed.png" headerAlt="New Order" />

      <Section style={bodyContent}>
        {/* Title */}
        <Section style={section}>
          <Text style={heading}>
            New Order Received
          </Text>
          <Text style={paragraph}>
            A new order has been placed and requires processing.
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
              <Text style={labelText}>Customer:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{customerName}</Text>
            </Column>
          </Row>
          <Row style={detailRow}>
            <Column style={detailLabel}>
              <Text style={labelText}>Email:</Text>
            </Column>
            <Column style={detailValue}>
              <Text style={valueText}>{customerEmail}</Text>
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

        {/* Admin Panel Link */}
        <Section style={ctaSection}>
          <Text style={paragraph}>
            View and manage this order in the admin panel.
          </Text>
          <Button href={adminPanelUrl} variant="primary" size="medium">
            View in Admin Panel
          </Button>
        </Section>

        {/* System Message */}
        <Section style={systemSection}>
          <Text style={systemText}>
            This is an automated notification for new orders. Do not reply to this email.
          </Text>
        </Section>
      </Section>

      <EmailFooter />
    </EmailLayout>
  );
};

export default AdminNewOrderEmail;

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
  margin: '24px 0',
  borderTop: '1px solid #e5e7eb',
  borderBottom: 'none',
  borderLeft: 'none',
  borderRight: 'none',
};

const totalSection = {
  padding: '20px',
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  margin: '24px 0',
};

const totalLabel = {
  verticalAlign: 'middle' as const,
};

const totalValue = {
  verticalAlign: 'middle' as const,
  textAlign: 'right' as const,
};

const totalLabelText = {
  margin: '0',
  fontSize: '18px',
  fontWeight: '700' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const totalValueText = {
  margin: '0',
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const ctaSection = {
  padding: '24px 0',
  textAlign: 'center' as const,
};

const systemSection = {
  padding: '16px 0 0',
  margin: '0',
};

const systemText = {
  margin: '0',
  fontSize: '12px',
  color: '#94a3b8',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
  fontStyle: 'italic' as const,
};
