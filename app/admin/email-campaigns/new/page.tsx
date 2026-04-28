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
      html: true,
      text: true,
    },
    orderBy: { name: 'asc' },
  })

  return templates
}

async function getActiveDiscountCodes() {
  return prisma.discountCode.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, description: true },
  })
}

export default async function NewCampaignPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    redirect('/admin')
  }

  const [templates, mailingLists, discountCodes] = await Promise.all([
    getTemplates(),
    getMailingLists(),
    getActiveDiscountCodes(),
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Create Email Campaign</h1>
        <p className="text-muted-foreground mt-1">
          Set up a mass email campaign with your chosen template
        </p>
      </div>

      <CampaignForm
        templates={templates}
        mailingLists={mailingLists}
        discountCodes={discountCodes}
      />
    </div>
  )
}
