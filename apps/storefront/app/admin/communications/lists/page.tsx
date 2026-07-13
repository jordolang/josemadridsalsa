import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { ListsTable } from './components/ListsTable'

export const metadata: Metadata = {
  title: 'Mailing Lists - Admin',
}

export default async function MailingListsPage() {
  const user = await getCurrentUser()
  const canManageLists = await hasPermission(user, 'content:write')
  
  if (!user || !canManageLists) {
    redirect('/admin/communications')
  }

  const lists = await prisma.mailingList.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { subscribers: { where: { status: 'SUBSCRIBED' } } }
      }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mailing Lists</h1>
          <p className="text-muted-foreground">Manage email lists and their subscribers for targeted marketing campaigns.</p>
        </div>
      </div>

      <ListsTable lists={lists} />
    </div>
  )
}
