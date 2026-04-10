import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Eye, Search } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPrice, getGiftCertificateThemeText } from '@/lib/utils'

interface SearchParams {
  search?: string
  status?: string
  page?: string
}

async function getGiftCertificates(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 50
  const skip = (page - 1) * limit

  const where: any = {}

  // Search filter
  if (searchParams.search) {
    where.OR = [
      { code: { contains: searchParams.search, mode: 'insensitive' } },
      { purchaserEmail: { contains: searchParams.search, mode: 'insensitive' } },
      { purchaserName: { contains: searchParams.search, mode: 'insensitive' } },
      { recipientEmail: { contains: searchParams.search, mode: 'insensitive' } },
      { recipientName: { contains: searchParams.search, mode: 'insensitive' } },
    ]
  }

  // Status filter
  if (searchParams.status && searchParams.status !== 'all') {
    where.status = searchParams.status
  }

  const [giftCertificates, total] = await Promise.all([
    prisma.giftCertificate.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            orderNumber: true,
            paymentStatus: true,
          },
        },
        _count: {
          select: {
            usages: true,
          },
        },
      },
    }),
    prisma.giftCertificate.count({ where }),
  ])

  return {
    giftCertificates,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  REDEEMED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-muted text-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
}

export default async function GiftCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams;
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin')
  }

  const { giftCertificates, total, page, totalPages } = await getGiftCertificates(params)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gift Certificates</h1>
          <p className="text-muted-foreground mt-1">
            Manage gift certificates, view balances, and track usage
          </p>
        </div>
      </div>

      <Card>
        <div className="p-6">
          <form method="get" className="space-y-4 mb-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  name="search"
                  placeholder="Search by code, email, or name..."
                  defaultValue={params.search}
                  className="pl-10"
                />
              </div>
              <Select
                name="status"
                defaultValue={params.status || 'all'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="REDEEMED">Redeemed</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="bg-salsa-500 hover:bg-salsa-600">
                Apply Filters
              </Button>
            </div>
            {params.search || (params.status && params.status !== 'all') ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = '/admin/gift-certificates'
                }}
              >
                Clear Filters
              </Button>
            ) : null}
          </form>

          <div className="text-sm text-muted-foreground mb-4">
            Showing {giftCertificates.length} of {total} gift certificates
          </div>

          {giftCertificates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No gift certificates found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Purchaser</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Recipient</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Balance</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Theme</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {giftCertificates.map((gc) => (
                    <tr key={gc.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-sm">{gc.code}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <div className="font-medium text-foreground">{gc.purchaserName}</div>
                          <div className="text-muted-foreground">{gc.purchaserEmail}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <div className="font-medium text-foreground">{gc.recipientName}</div>
                          {gc.recipientEmail && (
                            <div className="text-muted-foreground">{gc.recipientEmail}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-foreground">
                          {formatPrice(Number(gc.originalAmount))}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            Number(gc.balance) > 0 ? 'text-green-600' : 'text-muted-foreground'
                          }`}
                        >
                          {formatPrice(Number(gc.balance))}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {getGiftCertificateThemeText(gc.theme)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            statusColors[gc.status] || 'bg-muted text-foreground'
                          }`}
                        >
                          {gc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(gc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/admin/gift-certificates/${gc.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`?${new URLSearchParams({ ...params, page: String(page - 1) })}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?${new URLSearchParams({ ...params, page: String(page + 1) })}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

