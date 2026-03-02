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
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">No Analysis Data</h1>
          <p className="mt-2 text-gray-600">
            Run the analyzer to generate project status data.
          </p>
        </div>
        <div className="rounded-lg bg-blue-50 border-2 border-blue-200 p-6 max-w-md">
          <h2 className="font-semibold text-blue-900 mb-2">How to run analyzer:</h2>
          <pre className="bg-blue-900 text-blue-50 p-3 rounded font-mono text-sm">
            npm run analyze
          </pre>
          <p className="text-sm text-blue-700 mt-2">
            This will scan the codebase and generate completion metrics.
          </p>
        </div>
      </div>
    )
  }

  return <ProjectStatusDashboard analysis={analysis} />
}
