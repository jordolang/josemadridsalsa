import { redirect } from 'next/navigation'
import { getCurrentUser, getUserPermissions } from '@/lib/rbac'
import { adminNavigation, filterNavByPermissions } from '@/lib/permissions-map'
import { AdminLayoutClient } from '@/components/admin/AdminLayoutClient'
import { Toaster } from '@/components/ui/toaster'
import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = createMetadata({
  title: 'Admin Panel - Jose Madrid Salsa',
  description: 'Administration panel for Jose Madrid Salsa staff and partners.',
  pathname: '/admin',
})

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
      <>
        <AdminLayoutClient user={user} navigation={filteredNav}>
          {children}
        </AdminLayoutClient>
        <Toaster />
      </>
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
