/**
 * Project Status Dashboard
 * José Madrid Salsa E-commerce Platform
 */

import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getLatestAnalysis } from '@/lib/project-analyzer'
import { ProjectStatusDashboard } from '@/components/admin/project-status/ProjectStatusDashboard'

export const metadata = {
  title: 'Project Status | Admin',
  description: 'View project completion metrics and development roadmap',
}

export default async function ProjectStatusPage() {
  // Check authentication
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'analytics:read'))) {
    redirect('/admin')
  }

  // Load analysis data
  const analysis = getLatestAnalysis()

  if (!analysis) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">No Analysis Data</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Run the analyzer to generate project status data.
          </p>
        </div>
        <div className="max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-2 font-semibold">How to run analyzer:</h2>
          <pre className="rounded bg-muted p-3 font-mono text-sm">
            npm run analyze
          </pre>
          <p className="mt-2 text-sm text-muted-foreground">
            This will scan the codebase and generate completion metrics.
          </p>
        </div>
      </div>
    )
  }

  return <ProjectStatusDashboard analysis={analysis} />
}
