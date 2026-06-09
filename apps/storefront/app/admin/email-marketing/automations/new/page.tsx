import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { AutomationBuilder } from '../AutomationBuilder'

export const metadata: Metadata = { title: 'New Automation - Admin' }

export default async function NewAutomationPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const templates = await prisma.emailTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, key: true, subject: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Automation</h1>
        <p className="text-muted-foreground">Create a trigger-based email sequence.</p>
      </div>
      <AutomationBuilder templates={templates} />
    </div>
  )
}
