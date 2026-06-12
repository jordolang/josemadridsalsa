import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Terminal } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { DeveloperConsoleNav } from '@/components/admin/developer/DeveloperConsoleNav'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Developer Console - Jose Madrid Salsa Admin',
  description: 'Super admin console for the platform developer.',
  pathname: '/admin/developer',
})

export default async function DeveloperConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin?callbackUrl=/admin/developer')
  }

  if (!(await hasPermission(user, 'developer:access'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/30 bg-zinc-950 px-6 py-5 text-zinc-50 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/40">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-semibold tracking-tight">
                Developer Console
              </h1>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/40">
                Super Admin
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              Full platform control — storage, documentation, content, and system internals.
            </p>
          </div>
        </div>
        <DeveloperConsoleNav />
      </div>
      {children}
    </div>
  )
}
