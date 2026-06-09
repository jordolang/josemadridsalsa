import { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { EmailLogsClient } from './EmailLogsClient'

export const metadata: Metadata = { title: 'Email Logs - Admin' }

export default async function EmailLogsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Logs</h1>
        <p className="text-muted-foreground">Track delivery, opens, clicks, and failures for all outgoing emails</p>
      </div>
      <EmailLogsClient />
    </div>
  )
}
