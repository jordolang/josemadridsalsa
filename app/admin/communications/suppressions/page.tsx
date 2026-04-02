import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { SuppressionsClient } from './SuppressionsClient'

export const metadata: Metadata = { title: 'Suppression List - Admin' }

export default async function SuppressionsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin/communications')
  }

  const [suppressions, total] = await Promise.all([
    prisma.emailSuppression.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.emailSuppression.count(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suppression List</h1>
        <p className="text-muted-foreground">
          Manage email addresses that should never receive marketing emails. Hard bounces and spam
          complaints are added automatically.
        </p>
      </div>
      <SuppressionsClient initialData={suppressions} initialTotal={total} />
    </div>
  )
}
