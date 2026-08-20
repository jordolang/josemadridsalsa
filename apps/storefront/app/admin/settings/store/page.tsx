import { redirect } from 'next/navigation'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getStoreSettings } from '@/lib/store-settings'
import { StoreSettingsForm } from './store-settings-form'

export const dynamic = 'force-dynamic'

export default async function StoreSettingsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const settings = await getStoreSettings()
  const canWrite = await hasPermission(user, 'settings:write')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Store Settings</h1>
        <p className="text-sm text-muted-foreground">
          Store-wide controls: checkout rules, business identity, operational defaults, and legal
          page content. Each takes effect immediately across the storefront.
        </p>
      </div>
      <StoreSettingsForm initial={settings} canWrite={canWrite} />
    </div>
  )
}
