import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AutomationsClient } from './AutomationsClient'

export const metadata: Metadata = { title: 'Email Automations - Admin' }

export default async function AutomationsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const automations = await prisma.emailAutomation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      steps: { orderBy: { order: 'asc' } },
      _count: { select: { enrollments: true } },
    },
  })

  const templates = await prisma.emailTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, key: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Automations</h1>
          <p className="text-muted-foreground">
            Trigger-based email sequences for lifecycle events.
          </p>
        </div>
        <Link href="/admin/email-marketing/automations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Automation
          </Button>
        </Link>
      </div>

      <AutomationsClient initialAutomations={automations} templates={templates} />
    </div>
  )
}
