'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Plus,
  FileText,
  Users,
  BarChart3,
  Mail,
  MapPin,
  Tag,
  Settings,
  Package,
  ShoppingCart,
  Image,
  MessageSquare,
} from 'lucide-react'
import Link from 'next/link'

interface QuickAction {
  label: string
  href: string
  icon: React.ElementType
  color: string
  description: string
}

const actions: QuickAction[] = [
  {
    label: 'New Product',
    href: '/admin/products/new',
    icon: Plus,
    color: 'bg-blue-500',
    description: 'Add a product',
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
    color: 'bg-emerald-500',
    description: 'View orders',
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    color: 'bg-purple-500',
    description: 'View reports',
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    color: 'bg-orange-500',
    description: 'Manage users',
  },
  {
    label: 'Locations',
    href: '/admin/locations',
    icon: MapPin,
    color: 'bg-red-500',
    description: 'Store locations',
  },
  {
    label: 'Email',
    href: '/admin/email-campaigns',
    icon: Mail,
    color: 'bg-teal-500',
    description: 'Campaigns',
  },
  {
    label: 'Media',
    href: '/admin/media',
    icon: Image,
    color: 'bg-pink-500',
    description: 'Manage files',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    color: 'bg-slate-500',
    description: 'Configure',
  },
]

export function QuickActionsGrid() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-muted"
              >
                <div
                  className={`${action.color} rounded-xl p-2.5 shadow-sm transition-transform group-hover:scale-110`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground hidden sm:block">
                    {action.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
