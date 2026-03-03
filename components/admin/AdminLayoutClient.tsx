'use client'

import { useState } from 'react'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import type { NavItem } from '@/lib/permissions-map'

interface AdminLayoutClientProps {
  user: {
    name: string | null
    email: string
    role: string
  }
  navigation: NavItem[]
  children: React.ReactNode
}

export function AdminLayoutClient({ user, navigation, children }: AdminLayoutClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <AdminSidebar navigation={navigation} className="hidden lg:block" />

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Mobile Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <AdminSidebar
              navigation={navigation}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <AdminTopbar
          user={user}
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
