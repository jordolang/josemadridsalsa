import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    trend: 'up' | 'down'
  }
  icon?: LucideIcon
  loading?: boolean
}

export function StatsCard({ title, value, change, icon: Icon, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-8 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-20 bg-slate-200 rounded" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {change && (
            <p className="mt-2 flex items-center text-sm">
              <span
                className={
                  change.trend === 'up'
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {change.trend === 'up' ? '↑' : '↓'} {Math.abs(change.value)}%
              </span>
              <span className="ml-2 text-slate-600">vs last period</span>
            </p>
          )}
        </div>
        {Icon && (
          <div className="rounded-full bg-slate-100 p-3">
            <Icon className="h-6 w-6 text-slate-600" />
          </div>
        )}
      </div>
    </Card>
  )
}
