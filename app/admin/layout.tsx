import { redirect } from 'next/navigation'
import { getCurrentUser, getUserPermissions } from '@/lib/rbac'
import { adminNavigation, filterNavByPermissions } from '@/lib/permissions-map'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopbar } from '@/components/admin/AdminTopbar'

export const metadata = {
  title: 'Admin Panel - Jose Madrid Salsa',
  description: 'Administration panel for Jose Madrid Salsa',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
    <div className="flex h-screen overflow-hidden bg-slate-50">
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
}
