import { notFound, redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import AutoPrint from '@/components/admin/AutoPrint'
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
      <div className="print:block" style={{ fontFamily: 'Arial, sans-serif', color: '#111', maxWidth: 600, margin: '0 auto', padding: 32 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #dc2626', paddingBottom: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#dc2626', margin: 0 }}>Jose Madrid Salsa</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>{SITE_DOMAIN}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>PACKING SLIP</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>Order #{order.orderNumber}</p>
            <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: 12 }}>
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Ship To */}
        {order.shippingAddress && (
          <div style={{ marginBottom: 24, padding: 16, border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', margin: '0 0 10px' }}>Ship To</h3>
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
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#4b5563' }}>
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
        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: 10 }}>Items to Pack</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151' }}>Item</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151' }}>SKU</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#374151' }}>Qty</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#374151' }}>Packed ✓</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ padding: '10px', fontSize: 13 }}>{item.productName}</td>
                <td style={{ padding: '10px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{item.productSku}</td>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{item.quantity}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #9ca3af', borderRadius: 3 }}></span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #111' }}>
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
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
            Shipping Method: <strong style={{ color: '#111' }}>{order.shippingMethod}</strong>
          </p>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, textAlign: 'center' }}>
            Packed by: _________________ &nbsp;&nbsp; Date: _________________
          </p>
        </div>

        {/* Print button (hidden when printing) */}
        <div className="print:hidden" style={{ marginTop: 32, textAlign: 'center' }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#dc2626', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Print Packing Slip
          </button>
        </div>
      </div>
    </>
  )
}
