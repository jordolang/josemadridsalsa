import { Section, Row, Column, Text } from '@react-email/components';

export interface OrderItem {
  quantity: number;
  productName: string;
  productSku: string;
  totalPrice: number | string;
}

interface OrderItemsTableProps {
  items: OrderItem[];
  showEmpty?: boolean;
  emptyMessage?: string;
}

export const OrderItemsTable = ({
  items,
  showEmpty = true,
  emptyMessage = 'This order contains digital items.',
}: OrderItemsTableProps) => {
  if (!items || items.length === 0) {
    if (!showEmpty) return null;

    return (
      <Section style={emptySection}>
        <Text style={emptyText}>{emptyMessage}</Text>
      </Section>
    );
  }

  return (
    <Section style={tableSection}>
      {items.map((item, index) => {
        const parsed = typeof item.totalPrice === 'number'
          ? item.totalPrice
          : Number(item.totalPrice);
        const lineTotal = Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';

        return (
          <Row key={`${item.productSku}-${index}`} style={itemRow}>
            <Column style={itemDetails}>
              <Text style={productName}>
                {item.quantity}× {item.productName}
              </Text>
              <Text style={skuText}>
                SKU: {item.productSku}
              </Text>
            </Column>
            <Column style={priceColumn}>
              <Text style={priceText}>
                ${lineTotal}
              </Text>
            </Column>
          </Row>
        );
      })}
    </Section>
  );
};

const tableSection = {
  padding: '0',
  margin: '0',
};

const emptySection = {
  padding: '16px 0',
  margin: '0',
};

const emptyText = {
  margin: '0',
  fontSize: '14px',
  color: '#6b7280',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const itemRow = {
  marginBottom: '16px',
  width: '100%',
};

const itemDetails = {
  verticalAlign: 'top' as const,
  paddingRight: '16px',
};

const productName = {
  margin: '0 0 4px',
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const skuText = {
  margin: '0',
  fontSize: '12px',
  color: '#6b7280',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};

const priceColumn = {
  verticalAlign: 'top' as const,
  textAlign: 'right' as const,
  width: '100px',
};

const priceText = {
  margin: '0',
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
};
