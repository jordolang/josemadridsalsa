/**
 * Jose Madrid Salsa - Growth Dashboard Admin Page
 * 
 * This is the admin route that displays the interactive growth dashboard.
 * 
 * Route: /admin/growth
 * Access: Admin users only
 * 
 * Features:
 * - 52-week growth visualization
 * - Real-time progress tracking
 * - Interactive timeline
 * - Comprehensive analytics
 * - Milestone tracking
 * - Financial projections
 */

import { Metadata } from 'next'
import GrowthDashboard from '@/components/dashboard/growth-dashboard'

export const metadata: Metadata = {
  title: 'Growth Dashboard | Jose Madrid Salsa Admin',
  description: '52-week growth strategy visualization and tracking',
}

export default function GrowthDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Optional: Add admin navigation breadcrumbs */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <a href="/admin" className="hover:text-foreground transition-colors">
              Admin
            </a>
            <span>/</span>
            <span className="text-foreground font-medium">Growth Dashboard</span>
          </nav>
        </div>
      </div>

      {/* Main Dashboard */}
      <GrowthDashboard />
    </div>
  )
}

/**
 * INTEGRATION NOTES:
 * 
 * 1. File Location:
 *    Place this file at: app/admin/growth/page.tsx
 * 
 * 2. Authentication (Optional but Recommended):
 *    Add authentication check before rendering:
 *    
 *    import { auth } from '@/lib/auth'
 *    import { redirect } from 'next/navigation'
 *    
 *    export default async function GrowthDashboardPage() {
 *      const session = await auth()
 *      
 *      if (!session?.user?.isAdmin) {
 *        redirect('/login?callbackUrl=/admin/growth')
 *      }
 *      
 *      return <GrowthDashboard />
 *    }
 * 
 * 3. Required Files:
 *    - components/dashboard/growth-dashboard.tsx (main component)
 *    - components/dashboard/growth-dashboard-types.ts (type definitions)
 * 
 * 4. Required Dependencies:
 *    - recharts
 *    - lucide-react
 *    - shadcn/ui components (card, tabs, progress, badge, button)
 * 
 * 5. Navigation Integration:
 *    Add to your admin navigation menu:
 *    
 *    <NavigationItem href="/admin/growth" icon={TrendingUp}>
 *      Growth Dashboard
 *    </NavigationItem>
 */
