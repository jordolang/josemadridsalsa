import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { EmailConfigForm } from './_components/email-config-form'

async function getEmailConfigurations() {
  const configs = await prisma.emailConfiguration.findMany({
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return configs
}

export default async function EmailSettingsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['settings:read']))) {
    redirect('/admin')
  }

  const canWrite = await hasAnyPermission(user, ['settings:write'])
  const rawConfigs = await getEmailConfigurations()

  // Strip encrypted passwords before sending to client — expose only a boolean flag
  const configs = rawConfigs.map(({ smtpPassword, ...rest }) => ({
    ...rest,
    hasPassword: Boolean(smtpPassword),
  }))

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Email Settings</h1>
        <p className="text-slate-600 mt-1">
          Configure SMTP servers and email sending preferences
        </p>
      </div>

      <EmailConfigForm
        configs={configs}
        canWrite={canWrite}
      />
    </div>
  )
}
