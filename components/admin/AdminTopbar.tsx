'use client'

import { Bell, Menu, Search, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

interface AdminTopbarProps {
  user: {
    name: string | null
    email: string
    role: string
  }
  onMenuClick?: () => void
}

export function AdminTopbar({ user, onMenuClick }: AdminTopbarProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800'
      case 'DEVELOPER':
        return 'bg-purple-100 text-purple-800'
      case 'STAFF':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-6">
      {/* Mobile menu button */}
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </Button>
      )}

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                <span className="text-sm font-medium">
                  {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden text-left md:block">
                <div className="text-sm font-medium">{user.name || 'User'}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name || 'User'}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/admin/settings/profile">Profile Settings</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/" target="_blank">
                View Website
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
