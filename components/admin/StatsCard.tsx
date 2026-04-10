import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type StatsCardColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'

interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    trend: 'up' | 'down'
  }
  icon?: LucideIcon
  loading?: boolean
  color?: StatsCardColor
  subtitle?: string
  progress?: number
}

const iconAccentMap: Record<StatsCardColor, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
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
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="min-w-0 flex-1">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {title}
          </CardDescription>
          <CardTitle className="mt-2 text-3xl font-bold tabular-nums">
            {value}
          </CardTitle>
        </div>
        {Icon && (
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              iconAccentMap[color]
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {change ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge
              variant={change.trend === 'up' ? 'default' : 'destructive'}
              className="px-1.5 py-0 text-[11px] font-semibold"
            >
              {change.trend === 'up' ? '↑' : '↓'} {Math.abs(change.value)}%
            </Badge>
            <span className="text-muted-foreground">
              {subtitle ?? 'vs last period'}
            </span>
          </div>
        ) : (
          subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )
        )}
        {progress !== undefined && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <Progress value={Math.min(progress, 100)} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
