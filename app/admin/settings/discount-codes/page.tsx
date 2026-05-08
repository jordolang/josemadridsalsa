import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import {
  DiscountCodesManager,
  type DiscountCodeRow,
} from './_components/discount-codes-manager'

async function getDiscountCodes(): Promise<DiscountCodeRow[]> {
  const codes = await prisma.discountCode.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  })
  return codes.map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value.toString(),
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    maxUsesPerUser: c.maxUsesPerUser,
    minPurchase: c.minPurchase ? c.minPurchase.toString() : null,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    isActive: c.isActive,
  }))
}

export default async function DiscountCodesPage() {
  const user = await getCurrentUser()

  if (
    !user ||
    !(await hasAnyPermission(user, [
      'settings:read',
      'orders:read',
      'orders:write',
    ]))
  ) {
    redirect('/admin')
  }

  const canWrite = await hasAnyPermission(user, ['orders:write', 'settings:write'])
  const codes = await getDiscountCodes()

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Discount Codes</h1>
        <p className="text-muted-foreground mt-1">
          Manage discount codes available across the storefront and email campaigns.
        </p>
      </div>

      <DiscountCodesManager codes={codes} canWrite={canWrite} />
    </div>
  )
}
