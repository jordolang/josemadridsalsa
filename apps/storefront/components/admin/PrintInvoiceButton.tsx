'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

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
  const [generating, setGenerating] = useState(false)

  // @react-pdf/renderer is heavy and has known failures on mobile Safari when
  // loaded eagerly, so it is only imported once a PDF is asked for. The PDF is
  // built with pdf().toBlob() rather than <PDFDownloadLink>: wrapping the
  // document in next/dynamic put React.lazy inside react-pdf's renderer, which
  // threw "ie is not a function" and took down the whole order page.
  const downloadPdf = async () => {
    setGenerating(true)
    try {
      const [{ pdf }, { default: InvoicePDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/admin/InvoicePDF'),
      ])
      const invoiceOrder = {
        ...order,
        shippingAddress: mapAddress(order.shippingAddress),
        billingAddress: mapAddress(order.billingAddress),
      }
      const blob = await pdf(<InvoicePDF order={invoiceOrder} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${order.orderNumber}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      toast.error('Could not create the invoice PDF', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => window.open(`/admin/orders/${order.id}/invoice`, '_blank')}
      >
        <FileText className="mr-2 h-4 w-4" />
        Print Invoice
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={downloadPdf}
        disabled={generating}
      >
        <Download className="mr-2 h-4 w-4" />
        {generating ? 'Generating...' : 'Download Invoice PDF'}
      </Button>
    </>
  )
}
