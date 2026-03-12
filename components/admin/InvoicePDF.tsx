'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    color: '#64748b',
  },
  value: {
    fontFamily: 'Helvetica-Bold',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  colProduct: { flex: 3 },
  colSku: { flex: 2 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  totalsSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    width: 200,
  },
  totalLabel: {
    flex: 1,
    color: '#64748b',
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 200,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  grandTotalLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  infoColumn: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
})

interface OrderItem {
  id: string
  productName: string
  productSku: string
  quantity: number
  unitPrice: number | { toString(): string }
  totalPrice: number | { toString(): string }
}

interface Address {
  firstName: string
  lastName: string
  address1: string
  address2?: string | null
  city: string
  state: string
  zipCode: string
  country: string
}

interface InvoiceOrder {
  id: string
  orderNumber: string
  createdAt: string | Date
  status: string
  paymentStatus: string
  items: OrderItem[]
  subtotal: number | { toString(): string }
  shippingCost: number | { toString(): string }
  tax: number | { toString(): string }
  discountAmount: number | { toString(): string }
  total: number | { toString(): string }
  shippingAddress?: Address | null
  billingAddress?: Address | null
  user?: {
    name?: string | null
    email: string
  } | null
}

function formatCurrency(value: number | { toString(): string }): string {
  return `$${Number(value).toFixed(2)}`
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatAddress(address: Address): string {
  const lines = [
    `${address.firstName} ${address.lastName}`,
    address.address1,
    address.address2,
    `${address.city}, ${address.state} ${address.zipCode}`,
    address.country,
  ]
  return lines.filter(Boolean).join('\n')
}

export default function InvoicePDF({ order }: { order: InvoiceOrder }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.subtitle}>Jose Madrid Salsa</Text>
          </View>
          <View style={{ alignItems: 'flex-end' as const }}>
            <Text style={styles.value}>Order #{order.orderNumber}</Text>
            <Text style={styles.subtitle}>{formatDate(order.createdAt)}</Text>
            <Text style={styles.subtitle}>Status: {order.status}</Text>
          </View>
        </View>

        {/* Customer & Address Info */}
        <View style={styles.infoGrid}>
          <View style={styles.infoColumn}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            {order.user && (
              <>
                {order.user.name && <Text>{order.user.name}</Text>}
                <Text>{order.user.email}</Text>
              </>
            )}
            {order.billingAddress && (
              <Text style={{ marginTop: 4 }}>
                {formatAddress(order.billingAddress)}
              </Text>
            )}
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.sectionTitle}>Ship To</Text>
            {order.shippingAddress && (
              <Text>{formatAddress(order.shippingAddress)}</Text>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={styles.colProduct}>Product</Text>
            <Text style={styles.colSku}>SKU</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {order.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colProduct}>{item.productName}</Text>
              <Text style={styles.colSku}>{item.productSku}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={styles.colTotal}>
                {formatCurrency(item.totalPrice)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.subtotal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Shipping</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.shippingCost)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.tax)}
            </Text>
          </View>
          {Number(order.discountAmount) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, { color: '#16a34a' }]}>
                -{formatCurrency(order.discountAmount)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(order.total)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your order! — Jose Madrid Salsa
        </Text>
      </Page>
    </Document>
  )
}
