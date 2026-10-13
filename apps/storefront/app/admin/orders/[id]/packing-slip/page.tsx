import { notFound, redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import AutoPrint from '@/components/admin/AutoPrint'
import PrintPageButton from '@/components/admin/PrintPageButton'
import { SITE_DOMAIN } from '@/lib/site-url'

async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      shippingAddress: true,
      user: true,
    },
  })
}

export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin/orders')
  }

  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <>
      <AutoPrint />
      <div className="print-document" style={{ fontFamily: 'Arial, sans-serif', color: '#0c0a09', maxWidth: 600, margin: '0 auto', padding: 32 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #d53030', paddingBottom: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#d53030', margin: 0 }}>Jose Madrid Salsa</h1>
            <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: 12 }}>{SITE_DOMAIN}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>PACKING SLIP</h2>
            <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: 12 }}>Order #{order.orderNumber}</p>
            <p style={{ margin: '2px 0 0', color: '#78716c', fontSize: 12 }}>
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Ship To */}
        {order.shippingAddress && (
          <div style={{ marginBottom: 24, padding: 16, border: '1px solid #e7e5e4', borderRadius: 6 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.05em', margin: '0 0 10px' }}>Ship To</h3>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            {order.shippingAddress.company && (
              <p style={{ margin: '2px 0 0', fontSize: 13 }}>{order.shippingAddress.company}</p>
            )}
            <p style={{ margin: '2px 0 0', fontSize: 13 }}>{order.shippingAddress.street}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13 }}>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13 }}>{order.shippingAddress.country}</p>
            {order.shippingAddress.phone && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#57534e' }}>
                Phone: {order.shippingAddress.phone}
              </p>
            )}
          </div>
        )}

        {/* Tracking */}
        {order.trackingNumber && (
          <div style={{ marginBottom: 24, padding: 12, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#166534', fontWeight: 600 }}>Tracking Number</p>
            <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#15803d' }}>
              {order.trackingNumber}
            </p>
          </div>
        )}

        {/* Items Table */}
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.05em', marginBottom: 10 }}>Items to Pack</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f4', borderBottom: '2px solid #d6d3d1' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#44403c' }}>Item</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#44403c' }}>SKU</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#44403c' }}>Qty</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#44403c' }}>Packed ✓</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e7e5e4', backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf9' }}>
                <td style={{ padding: '10px', fontSize: 13 }}>{item.productName}</td>
                <td style={{ padding: '10px', fontSize: 12, color: '#78716c', fontFamily: 'monospace' }}>{item.productSku}</td>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{item.quantity}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #78716c', borderRadius: 3 }}></span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #0c0a09' }}>
              <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 13 }}>Total Items</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                {order.items.reduce((sum, item) => sum + item.quantity, 0)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {/* Customer Notes */}
        {order.customerNotes && (
          <div style={{ marginBottom: 24, padding: 12, backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#92400e' }}>Customer Notes</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#78350f' }}>{order.customerNotes}</p>
          </div>
        )}

        {/* Shipping Method */}
        {order.shippingMethod && (
          <p style={{ fontSize: 12, color: '#78716c', margin: '0 0 16px' }}>
            Shipping Method: <strong style={{ color: '#0c0a09' }}>{order.shippingMethod}</strong>
          </p>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e7e5e4', paddingTop: 12, marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#78716c', margin: 0, textAlign: 'center' }}>
            Packed by: _________________ &nbsp;&nbsp; Date: _________________
          </p>
        </div>

        {/* Print button (hidden when printing) */}
        <div className="print:hidden" style={{ marginTop: 32, textAlign: 'center' }}>
          <PrintPageButton label="Print Packing Slip" />
        </div>
      </div>
    </>
  )
}
