'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ShoppingCart,
  UserPlus,
  Star,
  Package,
  CreditCard,
  MessageSquare,
  Activity,
} from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'order' | 'user' | 'review' | 'product' | 'payment' | 'message'
  message: string
  timestamp: string
  detail?: string
}

interface RecentActivityFeedProps {
  activities?: ActivityItem[]
}

const iconMap = {
  order: { icon: ShoppingCart, bg: 'bg-blue-100', text: 'text-blue-600' },
  user: { icon: UserPlus, bg: 'bg-emerald-100', text: 'text-emerald-600' },
  review: { icon: Star, bg: 'bg-amber-100', text: 'text-amber-600' },
  product: { icon: Package, bg: 'bg-purple-100', text: 'text-purple-600' },
  payment: { icon: CreditCard, bg: 'bg-green-100', text: 'text-green-600' },
  message: { icon: MessageSquare, bg: 'bg-pink-100', text: 'text-pink-600' },
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  if (!activities || activities.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          <span className="text-xs text-muted-foreground">Latest events</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const config = iconMap[activity.type]
            const Icon = config.icon
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${config.bg} shrink-0`}>
                  <Icon className={`h-4 w-4 ${config.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.message}
                  </p>
                  {activity.detail && (
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.detail}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {activity.timestamp}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
