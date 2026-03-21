import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { CampaignForm } from '../_components/campaign-form'

async function getMailingLists() {
  return prisma.mailingList.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      _count: {
        select: { subscribers: { where: { status: 'SUBSCRIBED' } } }
      }
    }
  })
}

async function getTemplates() {
  const templates = await prisma.emailTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      key: true,
      name: true,
      subject: true,
      category: true,
      variables: true,
    },
    orderBy: { name: 'asc' },
  })

  return templates
}

export default async function NewCampaignPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    redirect('/admin')
  }

  const [templates, mailingLists] = await Promise.all([
    getTemplates(),
    getMailingLists(),
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Create Email Campaign</h1>
        <p className="text-slate-600 mt-1">
          Set up a mass email campaign with your chosen template
        </p>
      </div>

      <CampaignForm templates={templates} mailingLists={mailingLists} />
    </div>
  )
}
