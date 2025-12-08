import { redirect } from 'next/navigation'
import { getCurrentUser, getUserPermissions } from '@/lib/rbac'
import { adminNavigation, filterNavByPermissions } from '@/lib/permissions-map'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = createMetadata({
  title: 'Admin Panel - Jose Madrid Salsa',
  description: 'Administration panel for Jose Madrid Salsa staff and partners.',
  pathname: '/admin',
})

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser()

    if (!user) {
      redirect('/auth/signin?callbackUrl=/admin')
    }

    // Check if user has staff access
    const allowedRoles = ['ADMIN', 'DEVELOPER', 'STAFF']
    if (!allowedRoles.includes(user.role)) {
      redirect('/')
    }

    // Get user permissions and filter navigation
    const userPermissions = await getUserPermissions(user)
    const filteredNav = filterNavByPermissions(adminNavigation, userPermissions)

    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Sidebar */}
        <AdminSidebar navigation={filteredNav} className="hidden lg:block" />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <AdminTopbar user={user} />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    )
  } catch (error) {
    console.error('[Admin Layout] Error:', error)
    // Return error page instead of crashing
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Unable to Load Admin Panel</h1>
          <p className="text-muted-foreground mb-4">
            An error occurred while loading the admin panel. Please try again later.
          </p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }
}
