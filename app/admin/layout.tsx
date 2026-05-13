import { redirect } from 'next/navigation'
import { getCurrentUser, getUserPermissions } from '@/lib/rbac'
import { adminNavigation, filterNavByPermissions } from '@/lib/permissions-map'
import { AdminLayoutClient } from '@/components/admin/AdminLayoutClient'
import { LiveChatNotifier } from '@/components/admin/LiveChatNotifier'
import { MobileAdminShell } from '@/components/admin/mobile/MobileAdminShell'
import { splitNavForMobile } from '@/lib/admin/mobile-nav'
import { Toaster } from '@/components/ui/sonner'
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
    const ALLOWED_ROLES = ['ADMIN', 'DEVELOPER', 'STAFF']
    if (!ALLOWED_ROLES.includes(user.role)) {
      redirect('/')
    }

    // Get user permissions and filter navigation
    const userPermissions = await getUserPermissions(user)
    const filteredNav = filterNavByPermissions(adminNavigation, userPermissions)
    const { primary: mobilePrimary, more: mobileMore } = splitNavForMobile(
      adminNavigation,
      userPermissions,
    )

    return (
      <>
        <AdminLayoutClient
          user={user}
          navigation={filteredNav}
          className="hidden md:grid"
        >
          {children}
        </AdminLayoutClient>
        <MobileAdminShell
          user={user}
          primary={mobilePrimary}
          more={mobileMore}
          className="md:hidden"
        >
          {children}
        </MobileAdminShell>
        <LiveChatNotifier />
        <Toaster />
      </>
    )
  } catch (error) {
    // Re-throw Next.js internal errors (redirect, notFound, etc.)
    if (error instanceof Error && error.message.startsWith('NEXT_')) {
      throw error
    }
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
