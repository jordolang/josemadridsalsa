import type { Metadata } from 'next'
import GrowthDashboard from '@/components/dashboard/growth-dashboard'

export const metadata: Metadata = {
  title: 'Growth Dashboard | Jose Madrid Salsa Admin',
  description: '52-week growth strategy visualization and tracking',
}

export default function GrowthDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
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
      <GrowthDashboard />
    </div>
  )
}
