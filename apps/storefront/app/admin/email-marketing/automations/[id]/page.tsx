import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect, notFound } from 'next/navigation'
import { AutomationBuilder } from '../AutomationBuilder'

export const metadata: Metadata = { title: 'Edit Automation - Admin' }

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const automation = await prisma.emailAutomation.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  if (!automation) notFound()

  const templates = await prisma.emailTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, key: true, subject: true },
    orderBy: { name: 'asc' },
  })

  const initialData = {
    id: automation.id,
    name: automation.name,
    description: automation.description,
    trigger: automation.trigger,
    isActive: automation.isActive,
    stopConditions: automation.stopConditions as Record<string, boolean> | null,
    steps: automation.steps.map((s) => ({
      templateId: s.templateId ?? '',
      delayHours: s.delayHours,
      subject: s.subject ?? '',
    })),
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Automation</h1>
        <p className="text-muted-foreground">{automation.name}</p>
      </div>
      <AutomationBuilder templates={templates} initialData={initialData} />
    </div>
  )
}
