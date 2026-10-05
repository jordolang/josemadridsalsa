'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import {
  ChevronsUpDown,
  ExternalLink,
  LogOut,
  Moon,
  Sun,
  UserCog,
} from 'lucide-react'
import { useTheme } from '@/components/ui/theme-provider'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavUserProps {
  user: {
    name: string | null
    email: string
    role: string
  }
  collapsed?: boolean
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (first + last).toUpperCase() || email[0].toUpperCase()
  }
  return email[0].toUpperCase()
}

function getRoleBadgeVariant(
  role: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (role) {
    case 'ADMIN':
      return 'destructive'
    case 'DEVELOPER':
      return 'default'
    case 'STAFF':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function NavUser({ user, collapsed = false }: NavUserProps) {
  const { theme, setTheme } = useTheme()
  const initials = getInitials(user.name, user.email)
  const displayName = user.name ?? 'User'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="jma-user"
          aria-label={`Account menu for ${displayName}`}
        >
          <span className="jma-avatar" aria-hidden="true">
            {initials}
          </span>
          {!collapsed && (
            <>
              <span className="jma-user-text">
                <span className="jma-user-name">{displayName}</span>
                <span className="jma-user-role">{user.role}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-3.5 opacity-60" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-60 rounded-lg"
        side="right"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
            <Avatar className="size-9 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
              <Badge
                variant={getRoleBadgeVariant(user.role)}
                className="mt-1 w-fit text-[10px]"
              >
                {user.role}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/admin/settings/profile">
              <UserCog />
              Profile Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/" target="_blank" rel="noreferrer">
              <ExternalLink />
              View Website
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
