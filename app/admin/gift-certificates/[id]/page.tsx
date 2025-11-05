import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { formatPrice, getGiftCertificateThemeText } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function GiftCertificateDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin')
  }

  const giftCertificate = await prisma.giftCertificate.findUnique({
    where: { id: params.id },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
        },
      },
      usages: {
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              orderNumber: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })

  if (!giftCertificate) {
    redirect('/admin/gift-certificates')
  }

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-800',
    REDEEMED: 'bg-blue-100 text-blue-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gift Certificate Details</h1>
          <p className="text-gray-600 mt-1">View complete gift certificate information</p>
        </div>
        <Link href="/admin/gift-certificates">
          <Button variant="outline">Back to List</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Certificate Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Code</dt>
                  <dd className="mt-1 text-lg font-mono font-semibold text-gray-900">
                    {giftCertificate.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Theme</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {getGiftCertificateThemeText(giftCertificate.theme)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[giftCertificate.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {giftCertificate.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Original Amount</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {formatPrice(Number(giftCertificate.originalAmount))}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Balance</dt>
                  <dd
                    className={`mt-1 text-lg font-semibold ${
                      Number(giftCertificate.balance) > 0 ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {formatPrice(Number(giftCertificate.balance))}
                  </dd>
                </div>
                {giftCertificate.expiresAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Expires At</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(giftCertificate.expiresAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                {giftCertificate.message && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Message</dt>
                    <dd className="mt-1 text-sm text-gray-900">{giftCertificate.message}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchaser Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{giftCertificate.purchaserName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{giftCertificate.purchaserEmail}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipient Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{giftCertificate.recipientName}</dd>
                </div>
                {giftCertificate.recipientEmail && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{giftCertificate.recipientEmail}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Card>

        {giftCertificate.order && (
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Order Number</dt>
                  <dd className="mt-1">
                    <Link
                      href={`/admin/orders/${giftCertificate.order.id}`}
                      className="text-sm font-mono text-salsa-600 hover:text-salsa-700"
                    >
                      {giftCertificate.order.orderNumber}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payment Status</dt>
                  <dd className="mt-1 text-sm text-gray-900">{giftCertificate.order.paymentStatus}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Purchase Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(giftCertificate.order.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        )}

        {giftCertificate.usages.length > 0 && (
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage History</h2>
              <div className="space-y-3">
                {giftCertificate.usages.map((usage) => (
                  <div
                    key={usage.id}
                    className="border-b border-gray-200 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Used {formatPrice(Number(usage.amount))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Order:{' '}
                          <Link
                            href={`/admin/orders/${usage.order.id}`}
                            className="text-salsa-600 hover:text-salsa-700"
                          >
                            {usage.order.orderNumber}
                          </Link>
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(usage.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-600">Balance After</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatPrice(Number(usage.balanceAfter))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

