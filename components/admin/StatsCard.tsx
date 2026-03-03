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
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal'
  subtitle?: string
  progress?: number
}

const colorMap = {
  blue: {
    bg: 'bg-blue-500',
    light: 'bg-blue-50',
    text: 'text-blue-600',
    progressBg: 'bg-blue-100',
    progressFill: 'bg-blue-500',
  },
  green: {
    bg: 'bg-emerald-500',
    light: 'bg-emerald-50',
    text: 'text-emerald-600',
    progressBg: 'bg-emerald-100',
    progressFill: 'bg-emerald-500',
  },
  purple: {
    bg: 'bg-purple-500',
    light: 'bg-purple-50',
    text: 'text-purple-600',
    progressBg: 'bg-purple-100',
    progressFill: 'bg-purple-500',
  },
  orange: {
    bg: 'bg-orange-500',
    light: 'bg-orange-50',
    text: 'text-orange-600',
    progressBg: 'bg-orange-100',
    progressFill: 'bg-orange-500',
  },
  red: {
    bg: 'bg-red-500',
    light: 'bg-red-50',
    text: 'text-red-600',
    progressBg: 'bg-red-100',
    progressFill: 'bg-red-500',
  },
  teal: {
    bg: 'bg-teal-500',
    light: 'bg-teal-50',
    text: 'text-teal-600',
    progressBg: 'bg-teal-100',
    progressFill: 'bg-teal-500',
  },
}

export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  loading,
  color = 'blue',
  subtitle,
  progress,
}: StatsCardProps) {
  const colors = colorMap[color]

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
    <Card className="p-6 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {change && (
            <p className="mt-2 flex items-center text-sm">
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  change.trend === 'up'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {change.trend === 'up' ? '↑' : '↓'} {Math.abs(change.value)}%
              </span>
              <span className="ml-2 text-muted-foreground">
                {subtitle || 'vs last period'}
              </span>
            </p>
          )}
          {!change && subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`rounded-xl ${colors.bg} p-3 shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className={`h-1.5 w-full rounded-full ${colors.progressBg}`}>
            <div
              className={`h-1.5 rounded-full ${colors.progressFill} transition-all`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}
