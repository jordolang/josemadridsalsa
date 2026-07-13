'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

// @react-pdf/renderer is heavy and has known failures on mobile Safari when
// loaded eagerly. Gate it behind a user click so the order detail page always
// renders, and only pay the bundle/runtime cost when an invoice is requested.
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => null }
)

const InvoicePDF = dynamic(() => import('@/components/admin/InvoicePDF'), {
  ssr: false,
})

interface PrintInvoiceButtonProps {
  order: {
    id: string
    orderNumber: string
    createdAt: string
    status: string
    paymentStatus: string
    items: {
      id: string
      productName: string
      productSku: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }[]
    subtotal: number
    shippingCost: number
    tax: number
    discountAmount: number
    total: number
    shippingAddress?: {
      firstName: string
      lastName: string
      street: string
      city: string
      state: string
      zipCode: string
      country: string
    } | null
    billingAddress?: {
      firstName: string
      lastName: string
      street: string
      city: string
      state: string
      zipCode: string
      country: string
    } | null
    user?: {
      name?: string | null
      email: string
    } | null
  }
}

function mapAddress(addr: PrintInvoiceButtonProps['order']['shippingAddress']) {
  if (!addr) return null
  return {
    firstName: addr.firstName,
    lastName: addr.lastName,
    address1: addr.street,
    city: addr.city,
    state: addr.state,
    zipCode: addr.zipCode,
    country: addr.country,
  }
}

export default function PrintInvoiceButton({ order }: PrintInvoiceButtonProps) {
  const [armed, setArmed] = useState(false)
  const invoiceOrder = {
    ...order,
    shippingAddress: mapAddress(order.shippingAddress),
    billingAddress: mapAddress(order.billingAddress),
  }

  if (!armed) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setArmed(true)}
      >
        <FileText className="mr-2 h-4 w-4" />
        Print Invoice
      </Button>
    )
  }

  return (
    <PDFDownloadLink
      document={<InvoicePDF order={invoiceOrder} />}
      fileName={`invoice-${order.orderNumber}.pdf`}
      style={{ width: '100%', display: 'block' }}
    >
      {({ loading }) => (
        <Button variant="outline" className="w-full" disabled={loading}>
          <FileText className="mr-2 h-4 w-4" />
          {loading ? 'Generating...' : 'Download Invoice'}
        </Button>
      )}
    </PDFDownloadLink>
  )
}
