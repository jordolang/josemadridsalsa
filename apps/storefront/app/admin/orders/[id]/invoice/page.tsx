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
      billingAddress: true,
      user: true,
    },
  })
}

export default async function InvoicePage({
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

  const customerName = order.user
    ? order.user.name || order.user.email
    : order.shippingAddress
      ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
      : order.guestEmail || 'Guest'

  const customerEmail = order.user?.email ?? order.guestEmail ?? ''

  const billingAddress = order.billingAddress ?? order.shippingAddress

  return (
    <>
      <AutoPrint />
      <div className="print-document" style={{ fontFamily: 'Arial, sans-serif', color: '#0c0a09', maxWidth: 700, margin: '0 auto', padding: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#d53030', margin: 0 }}>Jose Madrid Salsa</h1>
            <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: 13 }}>{SITE_DOMAIN}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>INVOICE</h2>
            <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: 13 }}>Order #{order.orderNumber}</p>
            <p style={{ margin: '2px 0 0', color: '#78716c', fontSize: 13 }}>
              Date: {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div style={{ display: 'flex', gap: 40, marginBottom: 32 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.05em', marginBottom: 8 }}>Bill To</h3>
            <p style={{ margin: 0, fontWeight: 600 }}>{customerName}</p>
            {customerEmail && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#57534e' }}>{customerEmail}</p>}
            {billingAddress && (
              <>
                <p style={{ margin: '2px 0 0', fontSize: 13 }}>{billingAddress.street}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                  {billingAddress.city}, {billingAddress.state} {billingAddress.zipCode}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13 }}>{billingAddress.country}</p>
              </>
            )}
          </div>
          {order.shippingAddress && (
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.05em', marginBottom: 8 }}>Ship To</h3>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 13 }}>{order.shippingAddress.street}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 13 }}>{order.shippingAddress.country}</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ backgroundColor: '#fafaf9', borderBottom: '2px solid #e7e5e4' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#44403c' }}>Item</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#44403c' }}>SKU</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#44403c' }}>Qty</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#44403c' }}>Unit Price</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#44403c' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #e7e5e4', backgroundColor: i % 2 === 0 ? '#fff' : '#fafaf9' }}>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.productName}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#78716c', fontFamily: 'monospace' }}>{item.productSku}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13 }}>{item.quantity}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13 }}>${Number(item.unitPrice).toFixed(2)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>${Number(item.totalPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
          <div style={{ width: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: '#78716c' }}>Subtotal</span>
              <span>${Number(order.subtotal).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: '#78716c' }}>Shipping</span>
              <span>${Number(order.shippingCost).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: '#78716c' }}>Tax</span>
              <span>${Number(order.tax).toFixed(2)}</span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#16a34a' }}>
                <span>Discount</span>
                <span>-${Number(order.discountAmount).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, fontWeight: 700, borderTop: '2px solid #0c0a09' }}>
              <span>Total</span>
              <span>${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment & Tracking */}
        <div style={{ display: 'flex', gap: 40, marginBottom: 32 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.05em', marginBottom: 8 }}>Payment</h3>
            <p style={{ margin: 0, fontSize: 13 }}>Method: {order.paymentMethod || 'N/A'}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13 }}>Status: {order.paymentStatus}</p>
          </div>
          {order.trackingNumber && (
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#78716c', letterSpacing: '0.05em', marginBottom: 8 }}>Tracking</h3>
              <p style={{ margin: 0, fontSize: 13, fontFamily: 'monospace' }}>{order.trackingNumber}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e7e5e4', paddingTop: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#78716c', margin: 0 }}>
            Thank you for your business! Questions? Contact us at {SITE_DOMAIN}
          </p>
        </div>

        {/* Print button (hidden when printing) */}
        <div className="print:hidden" style={{ marginTop: 32, textAlign: 'center' }}>
          <PrintPageButton label="Print Invoice" />
        </div>
      </div>
    </>
  )
}
