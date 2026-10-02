import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Wholesale Account - Jose Madrid Salsa Admin',
  description: 'Wholesale account application details.',
  pathname: '/admin/wholesale',
})

export default async function WholesaleAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'users:read'))) {
    redirect('/admin')
  }

  const { id } = await params
  const account = await prisma.wholesaleAccount.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  })
  if (!account) notFound()

  const rows: Array<[string, string | null]> = [
    ['Business type', account.businessType],
    ['Contact', account.contactName],
    ['Email', account.user.email],
    ['Website', account.website],
    ['Tax ID', account.taxId],
    ['Resale number', account.resaleNumber],
    ['Years in business', account.yearsInBusiness?.toString() ?? null],
    ['Estimated volume', account.estimatedVolume],
    ['Discount rate', `${Number(account.discountRate)}%`],
    ['Minimum order', account.minimumOrder ? `$${Number(account.minimumOrder).toFixed(2)}` : null],
    ['Applied', account.createdAt.toLocaleDateString()],
    ['Approved', account.approvedAt?.toLocaleDateString() ?? null],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{account.businessName}</h1>
          <Badge className="mt-2">{account.status}</Badge>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/wholesale">Back to wholesale accounts</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
